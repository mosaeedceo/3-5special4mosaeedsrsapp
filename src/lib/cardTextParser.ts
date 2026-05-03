/**
 * Shared text/CSV parsing helpers for flashcard imports and bulk-add.
 * Used by both the file importer (`ankiParser.ts`) and the in-app
 * bulk-add dialog so they stay byte-for-byte consistent.
 */

/**
 * Minimal CSV parser supporting quoted fields with embedded separators / quotes.
 */
export const parseDelimitedLine = (line: string, sep: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"' && cur.length === 0) {
      inQuotes = true;
    } else if (c === sep) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
};

/**
 * Pick the most-likely separator (tab vs comma) from a sample of text.
 */
export const detectSeparator = (sample: string): '\t' | ',' => {
  const tabCount = (sample.match(/\t/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  return tabCount >= commaCount ? '\t' : ',';
};

/** Header column names that map to known card fields. */
const HEADER_FIELD_MAP: Record<string, 'front' | 'back' | 'tags' | 'langFront' | 'langBack' | 'lang'> = {
  front: 'front',
  question: 'front',
  term: 'front',
  word: 'front',
  prompt: 'front',
  q: 'front',
  back: 'back',
  answer: 'back',
  definition: 'back',
  meaning: 'back',
  response: 'back',
  a: 'back',
  tag: 'tags',
  tags: 'tags',
  langfront: 'langFront',
  frontlang: 'langFront',
  langf: 'langFront',
  lang_front: 'langFront',
  'lang-front': 'langFront',
  langback: 'langBack',
  backlang: 'langBack',
  langb: 'langBack',
  lang_back: 'langBack',
  'lang-back': 'langBack',
  lang: 'lang',
  language: 'lang',
  // Arabic equivalents
  'الأمام': 'front',
  'سؤال': 'front',
  'كلمة': 'front',
  'الخلف': 'back',
  'جواب': 'back',
  'تعريف': 'back',
};

/**
 * Heuristic: is this delimited row a header rather than card content?
 * Yes when both first columns are short, contain no HTML, and look like
 * field labels (front/back/question/answer/term/definition/...).
 */
export const isHeaderRow = (parts: string[]): boolean => {
  if (parts.length < 2) return false;
  // Reject obvious card content (long cells, HTML markup) in any of the
  // first few columns.
  for (const cell of parts.slice(0, Math.min(parts.length, 5))) {
    const v = (cell || '').trim();
    if (v.length > 32) return false;
    if (/[<>]/.test(v)) return false;
  }
  let hasFront = false;
  let hasBack = false;
  let recognized = 0;
  for (const cell of parts) {
    const role = HEADER_FIELD_MAP[(cell || '').trim().toLowerCase()];
    if (!role) continue;
    recognized += 1;
    if (role === 'front') hasFront = true;
    if (role === 'back') hasBack = true;
  }
  // A row is a header row when it names both a front and a back column,
  // and every recognized cell is a known header word (so `Hallo,Hello`
  // doesn't accidentally trip it).
  return hasFront && hasBack && recognized === parts.filter(c => (c || '').trim().length > 0).length;
};

export interface ParsedTextRow {
  front: string;
  back: string;
  tags?: string[];
  langFront?: string;
  langBack?: string;
}

/**
 * Build a normalized key for a (front, back) pair so we can detect duplicates
 * across cards regardless of casing or surrounding whitespace. Used by the
 * bulk-add flow to skip rows that already exist in the target deck.
 */
export const cardDedupeKey = (front: string, back: string): string =>
  `${front.trim().toLowerCase()}\u0000${back.trim().toLowerCase()}`;

export interface ParseTextOptions {
  /** Separator to use. If omitted, auto-detect from the input. */
  separator?: '\t' | ',';
  /**
   * Header handling:
   *  - 'auto' (default): skip the first row only if `isHeaderRow` says so
   *  - 'always': always skip the first non-blank, non-comment row
   *  - 'never':  never skip
   */
  header?: 'auto' | 'always' | 'never';
}

interface ColumnMap {
  front: number;
  back: number;
  tags: number;
  langFront: number;
  langBack: number;
}

/** Default positional layout: front, back, tags, langFront, langBack. */
const DEFAULT_COLUMN_MAP: ColumnMap = {
  front: 0,
  back: 1,
  tags: 2,
  langFront: 3,
  langBack: 4,
};

/**
 * Map a header row to a ColumnMap. Unknown columns are ignored. Returns null
 * if the header doesn't include both a front and back column.
 */
const buildColumnMap = (header: string[]): ColumnMap | null => {
  const map: ColumnMap = { front: -1, back: -1, tags: -1, langFront: -1, langBack: -1 };
  header.forEach((rawName, idx) => {
    const role = HEADER_FIELD_MAP[(rawName || '').trim().toLowerCase()];
    if (!role) return;
    if (role === 'lang') {
      // single "lang" column applies to both sides
      if (map.langFront === -1) map.langFront = idx;
      if (map.langBack === -1) map.langBack = idx;
    } else if (map[role] === -1) {
      map[role] = idx;
    }
  });
  if (map.front === -1 || map.back === -1) return null;
  return map;
};

const pickCell = (parts: string[], idx: number): string =>
  idx >= 0 && idx < parts.length ? (parts[idx] ?? '').trim() : '';

/**
 * Parse plain text / CSV / TSV content into rows of {front, back, tags?, langFront?, langBack?}.
 * Mirrors the file importer's rules (quoted fields, blank/# lines skipped,
 * header auto-detection). Pure / synchronous so it can drive a live preview.
 *
 * Optional columns:
 *  - tags     (column 3 by default; whitespace-separated list)
 *  - langFront / langBack (BCP-47 codes; can be supplied via header or in
 *    columns 4 and 5 positionally). A single `lang` header applies to both sides.
 */
export const parseCardText = (
  text: string,
  options: ParseTextOptions = {},
): ParsedTextRow[] => {
  const lines = text.split(/\r?\n/);
  const sep =
    options.separator ?? detectSeparator(lines.slice(0, 5).join('\n'));
  const headerMode = options.header ?? 'auto';

  const rows: ParsedTextRow[] = [];
  let firstDataRowSeen = false;
  let columnMap: ColumnMap = DEFAULT_COLUMN_MAP;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    const parts = parseDelimitedLine(line, sep);
    if (parts.length < 2) continue;

    if (!firstDataRowSeen) {
      firstDataRowSeen = true;
      const looksLikeHeader =
        headerMode === 'always' ||
        (headerMode === 'auto' && isHeaderRow(parts));
      if (looksLikeHeader) {
        const mapped = buildColumnMap(parts);
        if (mapped) columnMap = mapped;
        continue;
      }
    }

    const front = pickCell(parts, columnMap.front);
    const back = pickCell(parts, columnMap.back);
    if (!front || !back) continue;

    const tagsRaw = pickCell(parts, columnMap.tags);
    const tags = tagsRaw ? tagsRaw.split(/\s+/).filter(Boolean) : undefined;

    const langFrontRaw = pickCell(parts, columnMap.langFront);
    const langBackRaw = pickCell(parts, columnMap.langBack);
    const langFront = langFrontRaw || undefined;
    const langBack = langBackRaw || undefined;

    rows.push({ front, back, tags, langFront, langBack });
  }

  return rows;
};
