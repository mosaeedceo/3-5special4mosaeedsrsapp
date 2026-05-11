/**
 * Lightweight, script-based language auto-detection.
 *
 * Returns a BCP-47 tag when we are reasonably confident, otherwise `null`
 * so callers can fall back gracefully. We err on the side of returning `null`
 * for ambiguous Latin-script text.
 */

const stripHtml = (raw: string): string =>
  raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const detectLanguage = (raw: string): string | null => {
  const text = stripHtml(raw);
  if (!text) return null;

  // Non-Latin scripts → unambiguous.
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return 'ar-SA';
  if (/[\u0590-\u05FF]/.test(text)) return 'he-IL';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru-RU';
  if (/[\u0370-\u03FF]/.test(text)) return 'el-GR';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko-KR';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';

  // Latin-script heuristics — only return when a distinguishing
  // character is present, otherwise null.
  const hasGermanOnly = /ß/.test(text);
  const hasGermanUmlaut = /[ÄÖÜäöü]/.test(text);
  const hasSpanish = /[ñÑ¿¡]/.test(text);
  const hasFrenchOnly = /[œŒæÆçÇ]/.test(text) || /[àâèêëîïôùûÿ]/i.test(text);

  if (hasSpanish) return 'es-ES';
  if (hasGermanOnly) return 'de-DE';
  if (hasGermanUmlaut && !hasFrenchOnly) return 'de-DE';
  if (hasFrenchOnly && !hasGermanUmlaut) return 'fr-FR';

  return null;
};
