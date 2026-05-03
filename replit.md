# Spaced Study Pro - replit.md

## Overview

Spaced Study Pro is a mobile-first spaced repetition study application designed primarily for medical students. The app helps users memorize and retain information using scientifically-backed spaced repetition algorithms (FSRS-6). It supports both web and native mobile platforms (Android/iOS) through Capacitor, with features including lesson management, category organization, progress tracking, file attachments, comprehensive statistics, and an in-app user guide.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Framework
- **React 18** with TypeScript for type safety
- **Vite** as the build tool for fast development and optimized production builds
- **React Router** for client-side navigation with a bottom navigation pattern

### UI Component System
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for styling with custom theme support (10 color themes)
- Dark/light mode with system preference detection
- RTL (Arabic) and LTR (English) language support

### State Management
- **React Context** via `LocalStorageProvider` for global app state
- Custom `useLocalStorage` hook manages all data persistence
- **TanStack Query** available for future server-side data fetching

### Hook Patterns and Conventions
- **`useLocalStorage()`** — The singleton context hook. Returns `{ data, updateSettings, addLesson, importData, exportData, isCategoryLegacyMode, ... }`. Always destructure from this hook for read-only or add-only operations.
- **`useUndoableActions()`** — Wraps `useLocalStorage` and adds undo-aware wrappers for `deleteLesson`, `reviewLesson`, `updateLesson`, `addLesson`. **Always use this hook in pages that perform review or delete actions** (HomePage, LibraryPage). Do NOT call `useLocalStorage()` separately alongside `useUndoableActions()` — it spreads everything from it.
- `importData` returns `true` on success or `{ error: string }` on failure (not a plain boolean). Always check for the error shape.
- Navigation state types: pages pass typed state via `useNavigate()`; receiving pages read it with `useLocation().state as { fieldName?: Type } | null`.

### Library Page
- Sort preference and status filter are persisted in `sessionStorage` (keys: `library-sort-preference`, `library-status-preference`) so they survive tab switches within a session.
- Navigation-driven initial status filter (from Stats page) takes priority over stored session preference.
- **Bulk Delete**: Uses `batchDeleteWithUndo(ids)` from `useUndoableActions` — deletes all at once and shows a single "X lessons deleted — Undo" toast instead of one toast per lesson.

### Categories Page
- Per-category progress bar shows mastered/total ratio using `getCategoryStats()` data.
- Progress bar is hidden for Medical Board (endless) categories.

### Home Page (Tasks)
- CalendarStrip (days-of-week strip) is hidden on small screens (`hidden sm:block`) to save vertical space on phones.
- Active category filter chips show an `×` icon so users can tap once to dismiss the filter.

### LessonCard
- "Due in X days" / "Due on [date]" badge is hidden on small screens (`hidden sm:inline`) to keep cards compact on phones.
- RTL-aware status badge positioning: `ml-auto sm:ml-0 rtl:ml-0 rtl:mr-auto sm:rtl:mr-0`.

### Stats Page
- "Mastered" stat card now includes Medical Board lessons with `fsrs.stability >= 21` (mature/endless lessons) in the displayed count, so it's not confusingly zero for Medical Board-only users.

### Data Persistence
- **Web**: Browser localStorage for data storage
- **Native**: Capacitor Preferences API for structured data, Capacitor Filesystem for attachments
- Automatic data syncing with debounced saves and flush on app background

### Spaced Repetition Algorithm
- **FSRS-6** (Free Spaced Repetition Scheduler) implementation in `src/lib/fsrs.ts`
- Calculates optimal review intervals based on memory stability and retrievability
- Supports both legacy stage-based intervals and modern FSRS mode
- "Medical Board Mode" for endless review without completion state
- **Renewable Mastery**: In Normal FSRS mode, mastered lessons automatically become due again when their nextReviewDate passes (normalized on app load and visibility change)

### Mobile/Native Support
- **Capacitor** for native Android/iOS builds
- Native features: local notifications, file system access, voice recording, file sharing
- Progressive Web App capabilities for web users

### File Handling
- Attachments stored on device filesystem (native) or as data URLs (web)
- Lazy loading of attachment content to minimize memory usage
- Support for images, audio recordings, PDFs, and other document types

### Category Features
- **Custom Category Colors**: Categories can have optional background colors that apply as subtle tints (15% opacity) to lesson cards
- 10 preset color options with accessible color picker UI
- Color tint respects special states (missed, completed, at-risk, snoozed) and won't override them

### Page Interconnections
- **Stats → Home**: Tapping "Missed" stat card navigates to Home page (scrolls to missed section)
- **Stats → Home**: Tapping "Due Today" stat card navigates to Home page
- **Stats → Library**: Tapping "Mastered" stat card navigates to Library pre-filtered to completed lessons
- **Stats → Categories**: Tapping Medical Board category cards or Category Performance rows navigates to Categories page and scrolls to that category
- **Categories → Home (filtered)**: Per-category "Review →" button navigates to Home pre-filtered to that category's due/missed lessons
- **Categories → Home (no-due empty state)**: When navigating to Home with a category filter and 0 due lessons, shows a "nothing due" message with next review date and an "show all" escape button
- **Review Flow**: After rating a lesson, the app suggests the next due lesson for seamless review chaining
- **Home All-Done State**: When all due lessons are completed, a celebration card shows today's session count, streak, and next review time
- **Home Mastery Indicator**: When all lessons in a category are mastered (2+ lessons), a celebratory banner shows on the Home page
- **BottomNav Due Badge**: The Home tab icon shows a red badge with the count of due + missed lessons

### Home Page Features
- **Category Filter Chips**: Horizontal scrollable chips appear when due lessons span 2+ categories; tapping one filters the view
- **Session Progress Bar**: Shows how many lessons have been reviewed today vs. the full session scope
- **Streak Display**: Flame icon + streak count displayed in the header alongside the date
- **Per-category Due/Missed Badges**: Categories page shows colored count badges and a "Review →" quick-action

### Library Sorting
- **Sort Dropdown**: Sort lessons by Due Soonest, Title A→Z, Added Newest, or Memory Strength ↓
- Applied after filtering, does not affect other views

### Study Reminders
- Settings card with toggle + time picker for daily reminder
- On native (Capacitor): schedules a real repeating daily notification via `@capacitor/local-notifications`
- On web: shows a passive info note about installing the app
- Settings fields: `reminderEnabled` (boolean), `reminderTime` (HH:MM string)
- **Auto-reschedule**: On each app load, `AppContent` in `App.tsx` re-schedules the notification using the saved `reminderTime` so it stays current after device reboots

### Week Structure
- **Saturday-to-Friday**: All weekly calculations (heatmap, weekly chart, weekly summary) use a consistent Saturday-to-Friday week structure
- getDay() mapping: [6=Sat, 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri]

### Internationalization
- Full Arabic and English language support
- Content-aware RTL detection for mixed-language text
- Translations in `src/lib/translations/` directory

## External Dependencies

### Core Runtime
- **@capacitor/core** - Native bridge for iOS/Android
- **@capacitor/filesystem** - Native file storage
- **@capacitor/preferences** - Native key-value storage
- **@capacitor/local-notifications** - Study reminders
- **@capacitor/share** - Share functionality
- **capacitor-voice-recorder** - Audio note recording

### UI Libraries
- **@radix-ui/*** - Accessible UI primitives (dialogs, dropdowns, tooltips, etc.)
- **recharts** - Activity charts and statistics visualization
- **cmdk** - Command palette component
- **date-fns** - Date manipulation and formatting

### Build Tools
- **Vite** - Development server and bundler
- **TypeScript** - Type checking
- **Tailwind CSS** - Utility-first styling
- **PostCSS/Autoprefixer** - CSS processing

### Data Storage
- No external database - all data persisted locally
- Web: localStorage (JSON serialized)
- Native: Capacitor Preferences + Filesystem APIs
### Flashcards Tab (separate from Lessons)
- A 5th bottom-nav slot "Cards" leads to `/flashcards` (`FlashcardsPage`) and `/flashcards/:deckId/review` (`DeckReviewPage`).
- Decks (`Deck`) and cards (`Card`) live on `AppData.decks` / `AppData.cards`, completely separate from `lessons`. Existing tabs/pages are untouched.
- Imports are 100% client-side via `src/lib/ankiParser.ts`:
  - `.apkg` / `.colpkg` — uses `jszip` + `sql.js` (`sql-wasm.wasm` loaded via Vite `?url` import). Supports both legacy formats (`collection.anki2`, `collection.anki21`) and the modern Anki 2.1.50+ format (`collection.anki21b`, Zstd-compressed SQLite + protobuf `media` manifest with per-file Zstd-compressed payloads). Zstd decoding uses the `fzstd` pure-JS library; the protobuf `MediaEntries` manifest is parsed inline.
  - `.csv` / `.tsv` / `.txt` — first column = front, second = back, optional third column = whitespace-separated tags. Quoted CSV fields supported.
  - Standard Anki notes respect each card's template `ord`, rendering `qfmt`/`afmt` with `{{Field}}` / `{{#Field}}…{{/Field}}` / `{{FrontSide}}` substitution. Cloze notes generate one card per `{{cN::…}}` index.
  - Media (images + audio) referenced via `<img src="…">` and `[sound:…]` is extracted, persisted to `Directory.Data/attachments/` on native (web keeps inline data URLs), then resolved at render time by `src/lib/cardMedia.ts`.
- Card scheduling uses `src/lib/cardFsrs.ts`, a card-specific wrapper around the same FSRS-6 math used for lessons (`src/lib/fsrs.ts`). Cards keep their own `fsrs` state and `nextReviewDate`, with per-deck `newPerDay` cap (default 20).
- Card HTML is rendered through `dangerouslySetInnerHTML` only after `sanitizeCardHtml` (DOMPurify with a strict allowlist, no script/iframe/event handlers, restricted URL protocols).
- Deleting a deck cascades to its cards and best-effort deletes its media files from the native filesystem.
- Translations live under the `flashcards.*` namespace in both `en.ts` and `ar.ts`. RTL layout is mirrored in headers, deck rows, dropdown menus, and back navigation.
- **Bulk add cards**: `BulkAddCardsDialog` (`src/components/BulkAddCardsDialog.tsx`) lets users paste many cards at once into an existing deck — exposed from the deck dropdown on `FlashcardsPage` and from `CardManagerDialog`. Parsing rules (tab/comma detection, quoted fields, header auto-skip, `#` comments) live in the shared `src/lib/cardTextParser.ts`, which `ankiParser.parseTextOrCsv` also re-imports so file-import and bulk-add stay byte-for-byte consistent.

### Browse Tab (Library + Categories)
- The Library and Categories pages are merged into a single "Browse" bottom-nav tab at `/browse`.
- `BrowsePage` renders a segmented Tabs control (Library / Categories) and reuses `LibraryPage` and `CategoriesPage` as-is. Active sub-view is in `?view=library|categories` and persisted in `sessionStorage` (`browse-view-preference`).
- `/library` and `/categories` are kept as backwards-compat routes that `<Navigate>` to `/browse?view=...` while preserving navigation `state` (so existing `navigate('/library', { state: {...} })` calls from HomePage, StatsPage, CategoriesPage, EmptyState keep working).
- BottomNav highlights "Browse" for any of `/browse`, `/library`, `/categories`.
