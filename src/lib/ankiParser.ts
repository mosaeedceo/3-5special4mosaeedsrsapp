/**
 * Anki / CSV / TXT importer for flashcards.
 *
 * Supports:
 *  - .apkg / .colpkg (legacy Anki2 SQLite format with optional media)
 *  - .csv / .txt (front,back per line; supports tab or comma separator)
 *
 * Returns ImportResult with deck name, cards, and (web) inline media data.
 * The caller is responsible for persisting media to native filesystem.
 */

import JSZip from 'jszip';
import { decompress as zstdDecompress } from 'fzstd';
import initSqlJs, { Database } from 'sql.js';
// Vite asset URL — copies sql-wasm.wasm into the build output.
// eslint-disable-next-line import/no-unresolved
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Card, CardMedia } from '@/types/lesson';
import {
  parseDelimitedLine as sharedParseDelimitedLine,
  detectSeparator as sharedDetectSeparator,
  isHeaderRow as sharedIsHeaderRow,
  parseCardText as sharedParseCardText,
  looksLikeSentence,
} from '@/lib/cardTextParser';

export interface ParsedMedia {
  /** Original filename inside Anki package (e.g. "image_3.png") */
  name: string;
  /** Base64-encoded file contents */
  base64: string;
  /** MIME type guessed from extension */
  type: string;
  /** Byte size */
  size: number;
}

export interface ImportResult {
  deckName: string;
  cards: Omit<Card, 'deckId'>[];
  media: ParsedMedia[]; // raw media payloads, caller persists them
}

const guessMime = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    webm: 'audio/webm',
    flac: 'audio/flac',
    mp4: 'video/mp4',
  };
  return map[ext] || 'application/octet-stream';
};

const u8ToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
};

let sqlPromise: Promise<any> | null = null;
const loadSql = () => {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => sqlWasmUrl as string });
  }
  return sqlPromise;
};

// ============= CSV / TXT =============

// Re-exported from the shared cardTextParser so the file importer and the
// in-app bulk-add dialog use byte-for-byte the same parsing rules.
const parseDelimitedLine = sharedParseDelimitedLine;
const detectSeparator = sharedDetectSeparator;
const isHeaderRow = sharedIsHeaderRow;

export const parseTextOrCsv = async (
  file: File,
  deckNameOverride?: string,
): Promise<ImportResult[]> => {
  const text = await file.text();
  const rows = sharedParseCardText(text);
  const now = new Date().toISOString();

  const cards: Omit<Card, 'deckId'>[] = rows.map(r => ({
    id: crypto.randomUUID(),
    front: r.front,
    back: r.back,
    tags: r.tags,
    ttsLangFront: r.langFront,
    ttsLangBack: r.langBack,
    example: r.example,
    ttsLangExample: r.langExample,
    dateAdded: now,
    nextReviewDate: now,
  }));

  if (cards.length === 0) {
    throw new Error('No valid rows found. Each line must have at least front and back, separated by tab or comma.');
  }

  const deckName =
    deckNameOverride ?? file.name.replace(/\.[^.]+$/, '') ?? 'Imported Deck';

  return [{ deckName, cards, media: [] }];
};

// ============= Anki .apkg / .colpkg =============

interface AnkiNoteRow {
  id: number;
  flds: string;
  tags: string;
  mid: number;
}

interface AnkiCardRow {
  id: number;
  nid: number;
  did: number;
  ord: number;
}

const FIELD_SEP = '\x1f';

const stripAnkiFormatting = (html: string): string => {
  // Strip [sound:filename] markers — we render audio separately in the player.
  // Strip Anki's special tags but keep inline HTML for rendering.
  return html
    .replace(/\u001f/g, ' ')
    .trim();
};

/**
 * Find which media filenames are referenced in front/back text.
 * Anki stores <img src="filename.png"> and [sound:filename.mp3].
 */
const extractReferencedMedia = (text: string): Set<string> => {
  const refs = new Set<string>();
  const imgRe = /<img[^>]*src\s*=\s*["']([^"']+)["']/gi;
  const soundRe = /\[sound:([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(text))) refs.add(m[1]);
  while ((m = soundRe.exec(text))) refs.add(m[1]);
  return refs;
};

/**
 * Render cloze deletions for a specific cloze index.
 * Front: replace {{c1::text}} with [...]; keep other clozes' inner text.
 * Back: keep all answers visible.
 */
const renderCloze = (
  text: string,
  targetIdx: number,
  showAnswer: boolean,
): string => {
  // Match {{cN::answer}} or {{cN::answer::hint}}
  const re = /\{\{c(\d+)::([^}]+?)(?:::([^}]+?))?\}\}/g;
  return text.replace(re, (_full, num, answer, hint) => {
    const idx = parseInt(num, 10);
    if (idx === targetIdx) {
      if (showAnswer) return `<span class="cloze">${answer}</span>`;
      return hint
        ? `<span class="cloze-blank">[${hint}]</span>`
        : `<span class="cloze-blank">[...]</span>`;
    }
    return answer; // other clozes shown as plain text
  });
};

const findClozeIndices = (text: string): number[] => {
  const re = /\{\{c(\d+)::/g;
  const set = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) set.add(parseInt(m[1], 10));
  return Array.from(set).sort((a, b) => a - b);
};

interface AnkiTemplate {
  name: string;
  ord: number;
  qfmt: string; // question format with {{Field}} placeholders
  afmt: string; // answer format
}

interface AnkiModel {
  id: number;
  name: string;
  type: number; // 0 = standard, 1 = cloze
  flds: { name: string; ord: number }[];
  tmpls: AnkiTemplate[];
}

const parseModels = (modelsJson: string): Record<string, AnkiModel> => {
  try {
    const raw = JSON.parse(modelsJson) as Record<string, any>;
    const out: Record<string, AnkiModel> = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = {
        id: v.id,
        name: v.name,
        type: v.type ?? 0,
        flds: (v.flds || []).map((f: any) => ({ name: f.name, ord: f.ord })),
        tmpls: (v.tmpls || []).map((t: any) => ({
          name: t.name,
          ord: t.ord,
          qfmt: t.qfmt || '',
          afmt: t.afmt || '',
        })),
      };
    }
    return out;
  } catch {
    return {};
  }
};

/**
 * Render an Anki template ({{FieldName}} placeholders) by substituting field values.
 * Strips conditional `{{#Field}}...{{/Field}}` and `{{^Field}}...{{/Field}}` blocks
 * based on whether the field has content. Replaces {{FrontSide}} with the rendered
 * front (used by back templates).
 */
const renderTemplate = (
  template: string,
  fieldByName: Record<string, string>,
  frontRendered?: string,
): string => {
  let out = template;

  // Conditional blocks: {{#Field}}...{{/Field}} — keep only if field non-empty
  out = out.replace(/\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_full, name, body) => {
    const v = (fieldByName[name.trim()] || '').trim();
    return v ? body : '';
  });
  // Inverted: {{^Field}}...{{/Field}} — keep only if empty
  out = out.replace(/\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_full, name, body) => {
    const v = (fieldByName[name.trim()] || '').trim();
    return v ? '' : body;
  });

  // {{FrontSide}} — substitute the rendered front into the back template
  if (frontRendered !== undefined) {
    out = out.replace(/\{\{FrontSide\}\}/g, frontRendered);
  }

  // {{Field}}, {{text:Field}}, {{type:Field}}, {{cloze:Field}} (we only support standard sub here)
  out = out.replace(/\{\{(?:[a-zA-Z]+:)?([^}#^/][^}]*?)\}\}/g, (_full, rawName) => {
    const name = rawName.trim();
    if (name === 'FrontSide') return ''; // handled above
    return fieldByName[name] || '';
  });

  return out;
};

const parseDecks = (decksJson: string): Record<string, { id: number; name: string }> => {
  try {
    const raw = JSON.parse(decksJson) as Record<string, any>;
    const out: Record<string, { id: number; name: string }> = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = { id: v.id, name: v.name };
    }
    return out;
  } catch {
    return {};
  }
};

/**
 * Minimal protobuf decoder for the modern Anki21b `media` manifest.
 *
 * Schema (from Anki's import_export.proto):
 *   message MediaEntries {
 *     repeated MediaEntry entries = 1;
 *   }
 *   message MediaEntry {
 *     string name = 1;
 *     uint32 size = 2;
 *     bytes  sha1 = 3;
 *   }
 *
 * Returns the ordered list of entry names. The numbered file inside the zip
 * (`"0"`, `"1"`, …) corresponds to the entry at that index.
 */
const parseMediaEntries = (bytes: Uint8Array): string[] => {
  const names: string[] = [];
  let i = 0;

  const readVarint = (): number => {
    let result = 0;
    let shift = 0;
    while (i < bytes.length) {
      const b = bytes[i++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
      if (shift >= 35) break; // protect against absurdly large varints
    }
    return result >>> 0;
  };

  const decoder = new TextDecoder('utf-8');

  while (i < bytes.length) {
    const tag = readVarint();
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x7;

    if (fieldNum === 1 && wireType === 2) {
      // entries (embedded MediaEntry)
      const len = readVarint();
      const end = i + len;
      let name = '';
      while (i < end) {
        const innerTag = readVarint();
        const innerField = innerTag >>> 3;
        const innerWire = innerTag & 0x7;
        if (innerField === 1 && innerWire === 2) {
          const nameLen = readVarint();
          name = decoder.decode(bytes.subarray(i, i + nameLen));
          i += nameLen;
        } else if (innerWire === 0) {
          readVarint();
        } else if (innerWire === 2) {
          const skipLen = readVarint();
          i += skipLen;
        } else if (innerWire === 1) {
          i += 8;
        } else if (innerWire === 5) {
          i += 4;
        } else {
          // unknown wire type — abort entry
          i = end;
          break;
        }
      }
      i = end;
      names.push(name);
    } else if (wireType === 0) {
      readVarint();
    } else if (wireType === 2) {
      const skipLen = readVarint();
      i += skipLen;
    } else if (wireType === 1) {
      i += 8;
    } else if (wireType === 5) {
      i += 4;
    } else {
      break;
    }
  }

  return names;
};

interface AnkiMediaSource {
  /** Map from the original filename inside the deck (e.g. "image_3.png") to its zip key (e.g. "12"). */
  nameToZipKey: Map<string, string>;
  /** True for modern Anki21b packages where each numbered media file is Zstd-compressed. */
  zstdCompressedMedia: boolean;
}

export const parseAnkiPackage = async (file: File): Promise<ImportResult[]> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Detect package format. Modern Anki (2.1.50+) writes `collection.anki21b`,
  // a Zstd-compressed SQLite database, plus a protobuf-encoded `media`
  // manifest with each numbered media file individually Zstd-compressed.
  const modernDb = zip.file('collection.anki21b');
  const legacyDb = zip.file('collection.anki21') || zip.file('collection.anki2');
  const dbFile = modernDb || legacyDb;
  if (!dbFile) {
    throw new Error(
      'Invalid Anki package: no collection.anki2, collection.anki21, or collection.anki21b inside.',
    );
  }
  const isModern = !!modernDb;

  const SQL = await loadSql();
  let dbBytes = await dbFile.async('uint8array');
  if (isModern) {
    try {
      dbBytes = zstdDecompress(dbBytes);
    } catch (e) {
      throw new Error(
        'Failed to decompress modern .colpkg collection (anki21b). The file may be corrupt or from an unsupported Anki version.',
      );
    }
  }
  const db: Database = new SQL.Database(dbBytes);

  // Read collection metadata
  const colRes = db.exec('SELECT models, decks FROM col LIMIT 1');
  if (!colRes.length) {
    db.close();
    throw new Error('Invalid Anki collection (empty col table).');
  }
  const [modelsJson, decksJson] = colRes[0].values[0] as [string, string];
  const models = parseModels(modelsJson);
  const decks = parseDecks(decksJson);

  // Load notes
  const notes: Record<number, AnkiNoteRow> = {};
  const notesRes = db.exec('SELECT id, mid, flds, tags FROM notes');
  if (notesRes.length) {
    for (const row of notesRes[0].values) {
      const [id, mid, flds, tags] = row as [number, number, string, string];
      notes[id] = { id, mid, flds, tags };
    }
  }

  // Load cards
  const ankiCards: AnkiCardRow[] = [];
  const cardsRes = db.exec('SELECT id, nid, did, ord FROM cards');
  if (cardsRes.length) {
    for (const row of cardsRes[0].values) {
      const [id, nid, did, ord] = row as [number, number, number, number];
      ankiCards.push({ id, nid, did, ord });
    }
  }

  db.close();

  // Load media map. Two on-disk formats:
  //  - Legacy: JSON object {"0":"image.png","1":"sound.mp3",...}
  //  - Modern (anki21b): protobuf MediaEntries; entry index N → zip file "N".
  const mediaSource: AnkiMediaSource = {
    nameToZipKey: new Map(),
    zstdCompressedMedia: isModern,
  };
  const mediaMapFile = zip.file('media');
  if (mediaMapFile) {
    if (isModern) {
      const mediaBytes = await mediaMapFile.async('uint8array');
      const names = parseMediaEntries(mediaBytes);
      names.forEach((name, idx) => {
        if (name) mediaSource.nameToZipKey.set(name, String(idx));
      });
    } else {
      try {
        const mediaJson = JSON.parse(await mediaMapFile.async('string')) as Record<string, string>;
        for (const [zipKey, name] of Object.entries(mediaJson)) {
          mediaSource.nameToZipKey.set(name, zipKey);
        }
      } catch {
        // Malformed legacy media map — proceed with no media.
      }
    }
  }

  // Build cards, grouped by Anki deck id (did).
  const now = new Date().toISOString();
  const cardsByDid = new Map<number, Omit<Card, 'deckId'>[]>();
  const refsByDid = new Map<number, Set<string>>();

  const pushCard = (did: number, c: Omit<Card, 'deckId'>, refs: Set<string>) => {
    let bucket = cardsByDid.get(did);
    if (!bucket) {
      bucket = [];
      cardsByDid.set(did, bucket);
    }
    bucket.push(c);
    let refSet = refsByDid.get(did);
    if (!refSet) {
      refSet = new Set();
      refsByDid.set(did, refSet);
    }
    refs.forEach(r => refSet!.add(r));
  };

  for (const ac of ankiCards) {
    const note = notes[ac.nid];
    if (!note) continue;
    const model = models[String(note.mid)];
    if (!model) continue;

    const fields = note.flds.split(FIELD_SEP);
    const rawTagsString = note.tags.trim();
    let tags = rawTagsString ? rawTagsString.split(/\s+/).filter(Boolean) : [];
    // If the Anki "tags" string is actually a sentence (e.g. someone exported
    // a CSV with `front, back, sentence` and the sentence ended up in the
    // tags slot), promote it to an example field instead of polluting the
    // card with single-word tag badges.
    let promotedExample: string | undefined;
    if (tags.length >= 2 && looksLikeSentence(rawTagsString)) {
      promotedExample = rawTagsString;
      tags = [];
    }
    const isCloze = model.type === 1;
    const refs = new Set<string>();

    if (isCloze) {
      const sourceText = fields[0] || '';
      const clozeIdx = ac.ord + 1;
      const front = renderCloze(sourceText, clozeIdx, false);
      const extra = fields.slice(1).filter(Boolean).join('<br>');
      const back = renderCloze(sourceText, clozeIdx, true) +
        (extra ? `<hr>${extra}` : '');

      extractReferencedMedia(sourceText).forEach(m => refs.add(m));
      extractReferencedMedia(extra).forEach(m => refs.add(m));

      pushCard(ac.did, {
        id: crypto.randomUUID(),
        front: stripAnkiFormatting(front),
        back: stripAnkiFormatting(back),
        isCloze: true,
        clozeIndex: clozeIdx,
        clozeSource: sourceText,
        tags: tags.length ? tags : undefined,
        example: promotedExample,
        dateAdded: now,
        nextReviewDate: now,
      }, refs);
    } else {
      const fieldByName: Record<string, string> = {};
      model.flds.forEach((f, i) => {
        fieldByName[f.name] = fields[i] ?? '';
      });

      const tmpl =
        model.tmpls.find(t => t.ord === ac.ord) ||
        model.tmpls[ac.ord] ||
        model.tmpls[0];

      let front: string;
      let back: string;
      if (tmpl) {
        front = renderTemplate(tmpl.qfmt, fieldByName);
        back = renderTemplate(tmpl.afmt, fieldByName, front);
      } else {
        front = fields[0] || '';
        back = fields.slice(1).join('<br>') || front;
      }

      extractReferencedMedia(front).forEach(m => refs.add(m));
      extractReferencedMedia(back).forEach(m => refs.add(m));

      pushCard(ac.did, {
        id: crypto.randomUUID(),
        front: stripAnkiFormatting(front),
        back: stripAnkiFormatting(back),
        tags: tags.length ? tags : undefined,
        example: promotedExample,
        dateAdded: now,
        nextReviewDate: now,
      }, refs);
    }
  }

  if (cardsByDid.size === 0) {
    throw new Error('Anki package contained no cards.');
  }

  const fallbackName = file.name.replace(/\.[^.]+$/, '') || 'Imported Deck';
  const results: ImportResult[] = [];

  for (const [did, deckCards] of cardsByDid) {
    const deckEntry = Object.values(decks).find(d => d.id === did);
    const deckName = deckEntry?.name?.replace(/::/g, ' › ') || fallbackName;
    const refs = refsByDid.get(did) || new Set<string>();

    const media: ParsedMedia[] = [];
    for (const originalName of refs) {
      const zipKey = mediaSource.nameToZipKey.get(originalName);
      if (!zipKey) continue;
      const f = zip.file(zipKey);
      if (!f) continue;
      let bytes = await f.async('uint8array');
      if (mediaSource.zstdCompressedMedia) {
        try {
          bytes = zstdDecompress(bytes);
        } catch (e) {
          console.error('[ankiParser] Failed to decompress media', originalName, e);
          continue;
        }
      }
      media.push({
        name: originalName,
        base64: u8ToBase64(bytes),
        type: guessMime(originalName),
        size: bytes.length,
      });
    }

    results.push({ deckName, cards: deckCards, media });
  }

  // Stable order: largest deck first.
  results.sort((a, b) => b.cards.length - a.cards.length);
  return results;
};

// ============= Dispatcher =============

export const parseImportFile = async (file: File): Promise<ImportResult[]> => {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.apkg') || lower.endsWith('.colpkg')) {
    return parseAnkiPackage(file);
  }
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
    return parseTextOrCsv(file);
  }
  throw new Error('Unsupported file type. Use .apkg, .colpkg, .csv, .tsv, or .txt.');
};

// ============= Media persistence helper =============

/**
 * Persist media to native filesystem (or return inline web blobs).
 * Returns the CardMedia[] entries to attach to cards.
 */
export const persistMedia = async (
  media: ParsedMedia[],
): Promise<Map<string, CardMedia>> => {
  const result = new Map<string, CardMedia>();
  if (media.length === 0) return result;

  const { Capacitor } = await import('@capacitor/core');
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    // Web: keep inline as data URLs
    for (const m of media) {
      const id = crypto.randomUUID();
      result.set(m.name, {
        id,
        name: m.name,
        type: m.type,
        size: m.size,
        url: `data:${m.type};base64,${m.base64}`,
      });
    }
    return result;
  }

  // Native: write each file to attachments/ directory
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  try {
    await Filesystem.mkdir({
      path: 'attachments',
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // already exists
  }

  for (const m of media) {
    const id = crypto.randomUUID();
    // Sanitize filename to avoid path traversal & weird chars.
    const safeName = m.name.replace(/[^\w.\-]/g, '_');
    const filePath = `attachments/${id}_${safeName}`;
    try {
      await Filesystem.writeFile({
        path: filePath,
        data: m.base64,
        directory: Directory.Data,
      });
      const uri = await Filesystem.getUri({
        path: filePath,
        directory: Directory.Data,
      });
      result.set(m.name, {
        id,
        name: m.name,
        type: m.type,
        size: m.size,
        localPath: uri.uri,
      });
    } catch (e) {
      console.error('[ankiParser] Failed to persist media', m.name, e);
    }
  }
  return result;
};
