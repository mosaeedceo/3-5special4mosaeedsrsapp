import { describe, expect, it } from 'vitest';
import { looksLikeLanguageDeck } from './languageDeckDetect';
import type { Card, Deck } from '@/types/lesson';

const card = (front: string, back: string, extra: Partial<Card> = {}): Card => ({
  id: Math.random().toString(36).slice(2),
  deckId: 'd',
  front,
  back,
  dateAdded: '2024-01-01T00:00:00Z',
  nextReviewDate: '2024-01-01T00:00:00Z',
  ...extra,
});

describe('looksLikeLanguageDeck', () => {
  it('returns false for an empty deck with no cards', () => {
    expect(looksLikeLanguageDeck({}, [])).toBe(false);
  });

  it('detects a vocab deck from short term -> short translation pairs', () => {
    const cards = [
      card('die Katze', 'the cat'),
      card('der Hund', 'the dog'),
      card('das Haus', 'the house'),
      card('Apfel', 'apple'),
      card('Brot', 'bread'),
      card('Wasser', 'water'),
      card('lesen', 'to read'),
      card('schreiben', 'to write'),
    ];
    expect(looksLikeLanguageDeck({}, cards)).toBe(true);
  });

  it('detects a vocab deck when most cards have an example sentence', () => {
    const cards = Array.from({ length: 10 }, (_, i) =>
      card(
        `Long term number ${i} that exceeds the short threshold`,
        `Long translation for number ${i} that also exceeds`,
        { example: `Example sentence ${i} demonstrating usage.` },
      ),
    );
    expect(looksLikeLanguageDeck({}, cards)).toBe(true);
  });

  it('returns false for a non-vocab deck (long Q&A style)', () => {
    const cards = [
      card(
        'What is the capital of France and why is it historically significant?',
        'Paris has been the capital of France since the 10th century and is...',
      ),
      card(
        'Explain the difference between TCP and UDP protocols in detail.',
        'TCP is connection-oriented and reliable while UDP is connectionless...',
      ),
      card(
        'Describe the process of photosynthesis step by step.',
        'Photosynthesis converts light energy into chemical energy stored in glucose...',
      ),
    ];
    expect(looksLikeLanguageDeck({}, cards)).toBe(false);
  });

  it('ignores cloze cards when sampling', () => {
    const cards = [
      card('{{c1::Paris}} is the capital of France', '...', { isCloze: true }),
      card('{{c1::Berlin}} is the capital of Germany', '...', { isCloze: true }),
    ];
    expect(looksLikeLanguageDeck({}, cards)).toBe(false);
  });
});
