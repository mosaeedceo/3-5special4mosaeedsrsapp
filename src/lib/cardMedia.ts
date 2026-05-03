/**
 * Resolve card media: rewrite <img src="filename"> and [sound:filename]
 * tokens in card front/back HTML to use the actual blob/data/file URLs
 * (loaded from the filesystem on native, or kept inline on web).
 */
import DOMPurify from 'dompurify';
import { Card, CardMedia } from '@/types/lesson';
import { isNativePlatform } from '@/lib/platform';

const cache = new Map<string, string>(); // mediaId -> data URL (native only)

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadOne = async (m: CardMedia): Promise<string | undefined> => {
  if (m.url) return m.url;
  if (cache.has(m.id)) return cache.get(m.id)!;
  if (!isNativePlatform() || !m.localPath) return undefined;

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const idx = m.localPath.indexOf('attachments/');
    if (idx === -1) return undefined;
    const relPath = m.localPath.substring(idx);
    const result = await Filesystem.readFile({
      path: relPath,
      directory: Directory.Data,
    });
    const data = typeof result.data === 'string' ? result.data : '';
    if (!data) return undefined;
    const dataUrl = `data:${m.type};base64,${data}`;
    cache.set(m.id, dataUrl);
    return dataUrl;
  } catch (e) {
    console.warn('[cardMedia] failed to load', m.name, e);
    return undefined;
  }
};

export interface ResolvedCard {
  front: string;
  back: string;
  audioFront: string[]; // resolved audio URLs referenced from front
  audioBack: string[];
}

export const resolveCardMedia = async (card: Card): Promise<ResolvedCard> => {
  if (!card.media || card.media.length === 0) {
    return {
      front: card.front,
      back: card.back,
      audioFront: [],
      audioBack: [],
    };
  }

  const urlByName = new Map<string, { url: string; type: string }>();
  for (const m of card.media) {
    const url = await loadOne(m);
    if (url) urlByName.set(m.name, { url, type: m.type });
  }

  const replaceImages = (html: string): string =>
    html.replace(/<img([^>]*?)src\s*=\s*["']([^"']+)["']/gi, (full, attrs, src) => {
      const entry = urlByName.get(src);
      return entry ? `<img${attrs}src="${entry.url}"` : full;
    });

  const extractAudio = (html: string): { html: string; audio: string[] } => {
    const audio: string[] = [];
    const out = html.replace(/\[sound:([^\]]+)\]/gi, (_full, name) => {
      const entry = urlByName.get(name);
      if (entry) audio.push(entry.url);
      return ''; // remove the [sound:] token from displayed text
    });
    return { html: out, audio };
  };

  const f = extractAudio(replaceImages(card.front));
  const b = extractAudio(replaceImages(card.back));
  return {
    front: f.html,
    back: b.html,
    audioFront: f.audio,
    audioBack: b.audio,
  };
};

/**
 * Sanitize Anki HTML for safe use with dangerouslySetInnerHTML.
 * Uses DOMPurify with a strict allowlist suitable for flashcard content.
 */
const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'b', 'i', 'u', 'em', 'strong', 'br', 'p', 'div', 'span', 'sub', 'sup',
    'small', 'code', 'pre', 'blockquote', 'hr',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'img', 'figure', 'figcaption', 'a',
  ],
  ALLOWED_ATTR: ['src', 'alt', 'title', 'href', 'class', 'style', 'colspan', 'rowspan', 'width', 'height'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob|file|capacitor):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  KEEP_CONTENT: true,
};

export const sanitizeCardHtml = (html: string): string => {
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as unknown as string;
};
