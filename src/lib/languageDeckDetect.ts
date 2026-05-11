import type { Card, Deck } from '@/types/lesson';

const stripHtml = (s: string): string =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\[sound:[^\]]+\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const wordCount = (s: string): number => {
  const t = stripHtml(s);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
};

/**
 * Heuristic: does this deck look like a vocabulary / language-learning deck?
 *
 * Signals (any one is enough):
 *  - A meaningful share of cards (>= 30%) carry an `example` sentence —
 *    the dedicated example field is almost exclusively used for vocab.
 *  - Most cards (>= 70%) have a short front (1-3 words / <= 24 chars) AND
 *    a back that's also reasonably short (<= 8 words). This catches the
 *    classic "term -> translation" vocab card shape, including imported
 *    Anki decks.
 *
 * Returns false for empty decks so the original layout stays the default
 * until there's evidence either way.
 */
export const looksLikeLanguageDeck = (
  _deck: Deck | null | undefined,
  cards: Pick<Card, 'front' | 'back' | 'example' | 'isCloze'>[],
): boolean => {
  if (!cards || cards.length === 0) return false;

  const usable = cards.filter(c => !c.isCloze);
  if (usable.length === 0) return false;

  const sample = usable.slice(0, 60);
  const total = sample.length;

  let withExample = 0;
  let shortPair = 0;
  for (const c of sample) {
    if (c.example && stripHtml(c.example).length > 0) withExample++;
    const fw = wordCount(c.front);
    const bw = wordCount(c.back);
    const frontText = stripHtml(c.front);
    if (fw >= 1 && fw <= 3 && frontText.length <= 24 && bw >= 1 && bw <= 8) {
      shortPair++;
    }
  }

  if (withExample / total >= 0.3) return true;
  if (shortPair / total >= 0.7) return true;
  return false;
};
