export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type FSRSRating = 'again' | 'hard' | 'good' | 'easy';

export interface FSRSState {
  stability: number;      // Days until 90% forgetting probability
  difficulty: number;     // 1-10 scale
  elapsedDays: number;    // Days since last review
  scheduledDays: number;  // Interval calculated at last review
  reps: number;           // Total successful reviews
  lapses: number;         // Times forgotten (Again pressed)
  state: 'new' | 'learning' | 'review' | 'relearning';
  lastReview?: string;    // ISO timestamp
}

export interface ReviewHistoryEntry {
  date: string; // ISO timestamp
  rating: FSRSRating;
}

export interface LessonAttachment {
  id: string;
  name: string;
  type: string; // MIME type
  size: number; // File size in bytes
  localPath?: string; // Capacitor file path for persistence on native
  // url is now ONLY used for web platform or as temporary cache
  // On native, we load content on-demand from localPath
  url?: string;  // Optional - Data URL for web fallback only
}

export interface Lesson {
  id: string;
  title: string;
  category: string;
  subject: string;
  difficulty: Difficulty;
  dateAdded: string;
  nextReviewDate: string;
  currentStage: number;
  completed: boolean;
  reviewHistory?: ReviewHistoryEntry[]; // Track dates and ratings of past reviews
  customIntervals?: number[]; // Optional custom intervals for this lesson
  attachments?: LessonAttachment[]; // Optional file attachments
  fsrs?: FSRSState; // Optional FSRS state for adaptive scheduling
  notes?: string; // Optional study notes for this lesson
  tags?: string[]; // Optional hashtags for categorization (without # prefix)
  snoozedUntil?: string; // ISO date string - lesson is hidden until this date
  linkedDeckId?: string; // Optional flashcard deck linked to this lesson
}

export interface CategoryData {
  name: string;
  examDate?: string; // Optional exam date for countdown
  isMedicalBoardMode?: boolean; // Per-category endless FSRS mode
  isLegacyMode?: boolean; // Uses classic interval scheduling instead of FSRS
  legacyIntervals?: number[]; // Custom intervals for legacy mode
  snoozedUntil?: string; // ISO date string - all lessons in category hidden until this date
  color?: string; // Optional hex color for card background tint (e.g., "#3B82F6")
}

export type ColorTheme = 
  | 'zinc'      // Default
  | 'glacier'   // Cool blue
  | 'harvest'   // Warm amber
  | 'lavender'  // Purple
  | 'brutalist' // High contrast
  | 'obsidian'  // Deep dark
  | 'orchid'    // Pink/magenta
  | 'solar'     // Yellow/gold
  | 'tide'      // Ocean blue (replaces medical)
  | 'verdant';  // Forest green

export type DisplayMode = 'mobile' | 'tablet' | 'auto';

export type Language = 'en' | 'ar';

export interface FabPosition {
  x: number; // Percentage from left (0-100)
  y: number; // Percentage from top (0-100)
}

export interface Settings {
  intervals: number[];
  theme: 'light' | 'dark' | 'system';
  colorTheme: ColorTheme;
  displayMode: DisplayMode;
  useFSRS: boolean; // Enable FSRS algorithm
  desiredRetention: number; // 0.7 to 0.97, default 0.9
  medicalBoardMode: boolean; // Endless progression using pure FSRS
  masteryStabilityDays: number; // Stability threshold for completion (default: 21)
  language: Language; // UI language
  fabPosition: 'left' | 'right'; // Legacy: Floating action button position (left/right)
  fabCoordinates?: FabPosition; // New: Precise FAB coordinates
  hasSeenOnboarding?: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string; // HH:MM 24-hour format
  /**
   * Auto-suspend a card once its FSRS lapse count reaches this threshold.
   * 0 / undefined disables. Default: 8.
   */
  leechThreshold?: number;
  /**
   * When true, suppress the mid-review "leech suspended" toast and instead
   * surface a summary of suspended cards on the session-done card.
   * Default: false (toast is shown).
   */
  quietLeechNotifications?: boolean;
  lastTtsVoiceByLang?: Record<string, string>; // BCP-47 lang -> last picked voiceURI
  lastReviewedDeckId?: string; // Last deck the user reviewed (for FAB's "Add card" default)
}

export interface ActivityRecord {
  date: string; // YYYY-MM-DD format
  count: number;
}

export interface CardMedia {
  id: string;
  name: string;       // Original filename (e.g. "image_3.png")
  type: string;       // MIME type
  size: number;
  localPath?: string; // Native filesystem URI
  url?: string;       // Web data URL or blob (stripped on native before persist)
}

export interface Card {
  id: string;
  deckId: string;
  front: string;            // HTML or plain text
  back: string;             // HTML or plain text
  isCloze?: boolean;        // True if generated from cloze note
  clozeIndex?: number;      // Which cloze number this card represents
  clozeSource?: string;     // Original text with all {{c::}} markers
  tags?: string[];
  media?: CardMedia[];
  fsrs?: FSRSState;
  nextReviewDate: string;   // ISO; for new cards = dateAdded
  reviewHistory?: ReviewHistoryEntry[];
  dateAdded: string;
  suspended?: boolean;
  // Optional per-card TTS language override (BCP-47, e.g. "de-DE").
  // When set, takes precedence over auto-detection and the deck default.
  ttsLangFront?: string;
  ttsLangBack?: string;
}

export type EasyDayLevel = 'min' | 'reduced' | 'normal';

/**
 * Multiplier applied to the daily review allowance for the matching weekday.
 * - normal: full allowance (1.0)
 * - reduced: half allowance
 * - min: a quarter of the allowance (still > 0 so urgent cards aren't lost)
 */
export const EASY_DAY_SCALE: Record<EasyDayLevel, number> = {
  normal: 1,
  reduced: 0.5,
  min: 0.25,
};

/** Today-only bumps from the Custom Study flow. Cleared on local-day rollover. */
export interface DeckTodayBumps {
  date: string;            // YYYY-MM-DD (local)
  extraNew?: number;       // Additional new cards allowed today
  extraReviews?: number;   // Additional review cards allowed today
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  dateAdded: string;
  // -- Daily limits (undefined = use global default) --
  newPerDay?: number;                  // Default 20
  reviewsPerDay?: number;              // Default 200
  newCardsIgnoreReviewLimit?: boolean; // When true, new cards aren't counted against reviewsPerDay
  limitsStartFromTop?: boolean;        // When true, new cards are shown before reviews
  todayBumps?: DeckTodayBumps;         // One-day-only limit increases from Custom Study
  // -- FSRS overrides (undefined = use global setting) --
  desiredRetentionOverride?: number;   // 0.7 - 0.97
  leechThresholdOverride?: number;     // 0 = off, otherwise lapses count
  // -- Easy Days: per-weekday review-load scaling (Mon..Sun) --
  easyDays?: EasyDayLevel[];           // length 7 when set
  source?: 'anki' | 'csv' | 'manual';
  // Text-to-speech preferences (optional, per-deck)
  ttsFrontLang?: string;     // BCP-47 e.g. "de-DE"; empty/undefined = disabled
  ttsBackLang?: string;
  ttsFrontVoiceURI?: string; // Optional specific voice
  ttsBackVoiceURI?: string;
  ttsAutoPlay?: boolean;
  ttsRate?: number;          // 0.5 - 1.5, default 1.0
}

export interface AppData {
  lessons: Lesson[];
  settings: Settings;
  categories: string[];
  categoryData: CategoryData[]; // Enhanced category data with exam dates
  activityHistory: ActivityRecord[]; // For heatmap
  decks?: Deck[];               // Flashcard decks (separate from lessons)
  cards?: Card[];               // Flashcards (separate from lessons)
}

export const DEFAULT_INTERVALS = [1, 1, 4, 7, 14, 30];

export const DEFAULT_SETTINGS: Settings = {
  intervals: DEFAULT_INTERVALS,
  theme: 'light',
  colorTheme: 'tide',
  displayMode: 'auto',
  useFSRS: true,
  desiredRetention: 0.9,
  medicalBoardMode: false,
  masteryStabilityDays: 21,
  language: 'en',
  fabPosition: 'right',
  hasSeenOnboarding: false,
  reminderEnabled: false,
  reminderTime: '08:00',
  leechThreshold: 8,
  quietLeechNotifications: false,
};
