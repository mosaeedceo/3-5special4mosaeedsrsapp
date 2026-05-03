import type { Card } from '@/types/lesson';
import { looksLikeSentence } from '@/lib/cardTextParser';

export interface MigrationResult {
  cards: Card[];
  changedCount: number;
}

/**
 * Promote sentence-shaped `tags` arrays into the `example` field.
 *
 * For each card where:
 *   - `example` is empty/undefined, AND
 *   - the joined `tags` array (≥ 2 entries) reads like a sentence
 *     (per `looksLikeSentence`),
 * the joined string is moved into `example` and `tags` is cleared.
 *
 * Idempotent: re-running on already-migrated data returns
 * `changedCount === 0` and the same array reference for unchanged cards.
 *
 * Use `optionalDeckIdFilter` to scope the migration to a single deck
 * (for the manual "Clean up imported tags" action). Omit to migrate
 * across every deck (initial one-shot run).
 */
export const migrateTagsToExample = (
  cards: Card[],
  optionalDeckIdFilter?: string,
): MigrationResult => {
  let changedCount = 0;
  const next = cards.map(c => {
    if (optionalDeckIdFilter && c.deckId !== optionalDeckIdFilter) return c;
    if (c.example && c.example.trim().length > 0) return c;
    if (!c.tags || c.tags.length < 2) return c;
    const joined = c.tags.join(' ').trim();
    if (!joined) return c;
    if (!looksLikeSentence(joined)) return c;
    changedCount += 1;
    const { tags: _drop, ...rest } = c;
    return { ...rest, example: joined } as Card;
  });
  return { cards: changedCount > 0 ? next : cards, changedCount };
};
