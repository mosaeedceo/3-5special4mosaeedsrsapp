/**
 * FSRS scheduling for flashcards (separate from lesson FSRS to avoid coupling).
 * Uses the same FSRS-6 math as src/lib/fsrs.ts but operates on a generic FSRSState
 * + dateAdded pair, so it works with our Card type.
 */

import { FSRSState, FSRSRating } from '@/types/lesson';
import {
  calculateNextStability,
  calculateNextDifficulty,
  formatInterval,
} from './fsrs';

const DEFAULT_INITIAL_STABILITY: Record<FSRSRating, number> = {
  again: 0.4,
  hard: 0.6,
  good: 2.4,
  easy: 5.8,
};

const getInitialDifficulty = (rating: FSRSRating): number => {
  const g = { again: 1, hard: 2, good: 3, easy: 4 }[rating];
  // D0(G) = w4 - (G - 3) * w5  with w4=4.93, w5=0.94
  return Math.min(10, Math.max(1, 4.93 - (g - 3) * 0.94));
};

const getNextInterval = (stability: number, retention: number): number => {
  const interval = 9 * stability * (1 / retention - 1);
  return Math.max(1, Math.round(interval));
};

const newState = (): FSRSState => ({
  stability: 0.4,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 0,
  lapses: 0,
  state: 'new',
});

export const getCardReviewOptions = (
  card: { fsrs?: FSRSState; dateAdded: string },
  desiredRetention: number = 0.9,
): Record<FSRSRating, { interval: number; label: string }> => {
  const now = new Date();
  const lastReview = card.fsrs?.lastReview
    ? new Date(card.fsrs.lastReview)
    : new Date(card.dateAdded);
  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const currentState: FSRSState = card.fsrs || newState();

  const ratings: FSRSRating[] = ['again', 'hard', 'good', 'easy'];
  const options: Record<FSRSRating, { interval: number; label: string }> =
    {} as any;

  for (const rating of ratings) {
    let interval: number;
    if (currentState.state === 'new') {
      const s = DEFAULT_INITIAL_STABILITY[rating];
      interval = rating === 'again' ? 1 : Math.max(1, Math.round(s));
    } else if (rating === 'again') {
      interval = 1;
    } else {
      const nextStability = calculateNextStability(currentState, rating, elapsedDays);
      interval = getNextInterval(nextStability, desiredRetention);
    }
    interval = Math.min(365 * 10, Math.max(1, interval));
    options[rating] = { interval, label: formatInterval(interval) };
  }

  return options;
};

export const processCardReview = (
  card: { fsrs?: FSRSState; dateAdded: string },
  rating: FSRSRating,
  desiredRetention: number = 0.9,
): { fsrsState: FSRSState; nextReviewDate: Date } => {
  const now = new Date();
  const lastReview = card.fsrs?.lastReview
    ? new Date(card.fsrs.lastReview)
    : new Date(card.dateAdded);
  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const currentState: FSRSState = card.fsrs || newState();

  const newStability = currentState.state === 'new'
    ? DEFAULT_INITIAL_STABILITY[rating]
    : calculateNextStability(currentState, rating, elapsedDays);

  const newDifficulty = currentState.state === 'new'
    ? getInitialDifficulty(rating)
    : calculateNextDifficulty(currentState.difficulty, rating);

  let stateLabel: FSRSState['state'];
  if (rating === 'again') {
    stateLabel = currentState.state === 'new' ? 'learning' : 'relearning';
  } else {
    stateLabel = 'review';
  }

  let interval: number;
  if (rating === 'again') {
    interval = 1;
  } else {
    interval = getNextInterval(newStability, desiredRetention);
  }
  interval = Math.min(365 * 10, Math.max(1, interval));

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  const fsrsState: FSRSState = {
    stability: newStability,
    difficulty: newDifficulty,
    elapsedDays,
    scheduledDays: interval,
    reps: currentState.reps + (rating !== 'again' ? 1 : 0),
    lapses: currentState.lapses + (rating === 'again' ? 1 : 0),
    state: stateLabel,
    lastReview: now.toISOString(),
  };

  return { fsrsState, nextReviewDate };
};

/**
 * Returns true if a card should be auto-suspended as a leech given its
 * post-review FSRS state. Centralized here so any review path can apply
 * the same rule.
 *
 * - threshold <= 0 disables the feature.
 * - Cards already suspended are not re-flagged.
 * - A card becomes a leech once its lapse count reaches the threshold.
 */
export const shouldAutoSuspendAsLeech = (
  fsrsState: FSRSState,
  alreadySuspended: boolean | undefined,
  threshold: number,
): boolean => {
  if (!threshold || threshold <= 0) return false;
  if (alreadySuspended) return false;
  return fsrsState.lapses >= threshold;
};
