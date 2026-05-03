/**
 * FSRS-6 Algorithm Implementation
 * Free Spaced Repetition Scheduler
 * Based on: https://github.com/open-spaced-repetition/fsrs4anki
 */

import { FSRSState, FSRSRating, Lesson } from '@/types/lesson';

// FSRS-6 Default Parameters
const DEFAULT_PARAMS = {
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
  requestRetention: 0.9, // 90% desired retention
};

// Rating multipliers
const RATING_OFFSET: Record<FSRSRating, number> = {
  again: -1,
  hard: 0,
  good: 1,
  easy: 2,
};

/**
 * Calculate retrievability (probability of recall)
 * R(t) = (1 + t / (9 * S))^(-1)
 */
export const calculateRetrievability = (stability: number, elapsedDays: number): number => {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
};

/**
 * Calculate initial stability for new cards based on rating
 */
const getInitialStability = (rating: FSRSRating): number => {
  const w = DEFAULT_PARAMS.w;
  const ratingIndex = { again: 0, hard: 1, good: 2, easy: 3 };
  return Math.max(0.1, w[ratingIndex[rating]]);
};

/**
 * Calculate initial difficulty based on rating
 * D0(G) = w4 - (G - 3) * w5
 */
const getInitialDifficulty = (rating: FSRSRating): number => {
  const w = DEFAULT_PARAMS.w;
  const g = { again: 1, hard: 2, good: 3, easy: 4 }[rating];
  return Math.min(10, Math.max(1, w[4] - (g - 3) * w[5]));
};

/**
 * Calculate next difficulty after review
 * D'(D, G) = w7 * D0(3) + (1 - w7) * (D - w6 * (G - 3))
 */
export const calculateNextDifficulty = (
  currentDifficulty: number,
  rating: FSRSRating
): number => {
  const w = DEFAULT_PARAMS.w;
  const g = { again: 1, hard: 2, good: 3, easy: 4 }[rating];
  const d0 = w[4]; // D0(3) = w4
  
  const newD = w[7] * d0 + (1 - w[7]) * (currentDifficulty - w[6] * (g - 3));
  return Math.min(10, Math.max(1, newD));
};

/**
 * Calculate stability increase factor
 */
const calculateStabilityIncreaseFactor = (
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: FSRSRating
): number => {
  const w = DEFAULT_PARAMS.w;
  const g = { again: 1, hard: 2, good: 3, easy: 4 }[rating];
  
  // S'(D, S, R, G) = S * (e^w8 * (11-D) * S^(-w9) * (e^(w10*(1-R)) - 1) * w15*(if G=2) * w16*(if G=4) + 1)
  let factor = Math.exp(w[8]) * 
    (11 - difficulty) * 
    Math.pow(stability, -w[9]) * 
    (Math.exp(w[10] * (1 - retrievability)) - 1);
  
  // Apply rating modifiers
  if (rating === 'hard') factor *= w[15];
  if (rating === 'easy') factor *= w[16];
  
  return factor + 1;
};

/**
 * Calculate next stability after successful review
 */
export const calculateNextStability = (
  currentState: FSRSState,
  rating: FSRSRating,
  elapsedDays: number
): number => {
  const w = DEFAULT_PARAMS.w;
  
  // For new cards
  if (currentState.state === 'new') {
    return getInitialStability(rating);
  }
  
  // For cards in learning/relearning after "again"
  if (rating === 'again') {
    // S'(D, S) = w11 * D^(-w12) * ((S+1)^w13 - 1) * e^(w14*(1-R))
    const retrievability = calculateRetrievability(currentState.stability, elapsedDays);
    const newS = w[11] * 
      Math.pow(currentState.difficulty, -w[12]) * 
      (Math.pow(currentState.stability + 1, w[13]) - 1) * 
      Math.exp(w[14] * (1 - retrievability));
    return Math.max(0.1, Math.min(currentState.stability, newS));
  }
  
  // For successful reviews (hard, good, easy)
  const retrievability = calculateRetrievability(currentState.stability, elapsedDays);
  const factor = calculateStabilityIncreaseFactor(
    currentState.difficulty,
    currentState.stability,
    retrievability,
    rating
  );
  
  return Math.max(0.1, currentState.stability * factor);
};

/**
 * Calculate next interval from stability and desired retention
 * I(S, R) = S * (R^(1/-0.5) - 1)
 * Simplified: I = S * 9 * (1/R - 1)
 */
export const calculateNextInterval = (
  stability: number,
  desiredRetention: number = 0.9
): number => {
  const interval = (stability / 9) * (Math.pow(desiredRetention, -1) - 1);
  return Math.max(1, Math.round(interval * 9 * stability / (9 * stability) * 
    Math.pow(1 / desiredRetention - 1, -1)));
};

/**
 * Simplified interval calculation
 */
const getNextInterval = (stability: number, retention: number = 0.9): number => {
  // I = S × (R^(-1/0.5) - 1) simplified to practical formula
  const interval = 9 * stability * (1 / retention - 1);
  return Math.max(1, Math.round(interval));
};

/**
 * Get review options with predicted intervals for each rating
 */
export const getReviewOptions = (
  lesson: Lesson,
  desiredRetention: number = 0.9
): Record<FSRSRating, { interval: number; label: string }> => {
  const now = new Date();
  const lastReview = lesson.fsrs?.lastReview 
    ? new Date(lesson.fsrs.lastReview) 
    : new Date(lesson.dateAdded);
  const elapsedDays = Math.max(0, Math.floor(
    (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
  ));
  
  // Initialize or get current state
  const currentState: FSRSState = lesson.fsrs || {
    stability: 0.4,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    reps: 0,
    lapses: 0,
    state: 'new',
  };
  
  const ratings: FSRSRating[] = ['again', 'hard', 'good', 'easy'];
  const options: Record<FSRSRating, { interval: number; label: string }> = {} as any;
  
  for (const rating of ratings) {
    const nextStability = calculateNextStability(currentState, rating, elapsedDays);
    let interval: number;
    
    if (rating === 'again') {
      // "Again" gives a short interval (1 day or learning steps)
      interval = 1;
    } else {
      interval = getNextInterval(nextStability, desiredRetention);
    }
    
    // Clamp intervals to reasonable bounds
    interval = Math.min(365, Math.max(1, interval));
    
    options[rating] = {
      interval,
      label: formatInterval(interval),
    };
  }
  
  return options;
};

/**
 * Format interval for display
 */
export const formatInterval = (days: number): string => {
  if (days < 1) return '<1d';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? '1w' : `${weeks}w`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? '1mo' : `${months}mo`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? '1y' : `${years}y`;
};

/**
 * Process a review and return updated FSRS state
 */
export const processReview = (
  lesson: Lesson,
  rating: FSRSRating,
  desiredRetention: number = 0.9
): { fsrsState: FSRSState; nextReviewDate: Date } => {
  const now = new Date();
  const lastReview = lesson.fsrs?.lastReview 
    ? new Date(lesson.fsrs.lastReview) 
    : new Date(lesson.dateAdded);
  const elapsedDays = Math.max(0, Math.floor(
    (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
  ));
  
  // Get or initialize current state
  const currentState: FSRSState = lesson.fsrs || {
    stability: 0.4,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    reps: 0,
    lapses: 0,
    state: 'new',
  };
  
  // Calculate new values
  const newStability = calculateNextStability(currentState, rating, elapsedDays);
  const newDifficulty = currentState.state === 'new' 
    ? getInitialDifficulty(rating)
    : calculateNextDifficulty(currentState.difficulty, rating);
  
  // Determine new state
  let newState: FSRSState['state'];
  if (rating === 'again') {
    newState = currentState.state === 'new' ? 'learning' : 'relearning';
  } else {
    newState = 'review';
  }
  
  // Calculate interval
  let interval: number;
  if (rating === 'again') {
    interval = 1;
  } else {
    interval = getNextInterval(newStability, desiredRetention);
  }
  interval = Math.min(365, Math.max(1, interval));
  
  // Calculate next review date
  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  
  const fsrsState: FSRSState = {
    stability: newStability,
    difficulty: newDifficulty,
    elapsedDays,
    scheduledDays: interval,
    reps: currentState.reps + (rating !== 'again' ? 1 : 0),
    lapses: currentState.lapses + (rating === 'again' ? 1 : 0),
    state: newState,
    lastReview: now.toISOString(),
  };
  
  return { fsrsState, nextReviewDate };
};

/**
 * Convert legacy lesson stage to approximate FSRS state
 */
export const migrateToFSRS = (lesson: Lesson, intervals: number[]): FSRSState => {
  const stage = lesson.currentStage;
  const reps = lesson.reviewHistory?.length || stage;
  
  // Estimate stability from current stage
  const estimatedStability = intervals[Math.min(stage, intervals.length - 1)] || 1;
  
  // Estimate difficulty from lesson difficulty
  const difficultyMap = { Easy: 3, Medium: 5, Hard: 7 };
  const difficulty = difficultyMap[lesson.difficulty] || 5;
  
  return {
    stability: estimatedStability,
    difficulty,
    elapsedDays: 0,
    scheduledDays: intervals[Math.min(stage, intervals.length - 1)] || 1,
    reps,
    lapses: 0,
    state: reps === 0 ? 'new' : 'review',
    lastReview: lesson.reviewHistory?.[lesson.reviewHistory.length - 1]?.date,
  };
};
