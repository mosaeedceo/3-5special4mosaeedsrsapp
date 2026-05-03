
# Implementation Plan: Snooze Feature, FAB Improvements & Localization

## Overview

This plan covers all the requested changes:
1. **Snooze Feature** - Full implementation with snooze functions, UI integration
2. **Floating Add Button (FAB)** - Positioning fixes, no RTL flip, drag-to-reposition
3. **Localization** - Complete missing Arabic translations

---

## 1. Backend: Snooze Functions in useLocalStorage.tsx

### New Functions to Add

**1.1 `snoozeLesson(lessonId: string, until: Date)`**
- Sets `lesson.snoozedUntil = until.toISOString()`
- Sets `lesson.nextReviewDate = until.toISOString()`
- Freezes current stage/FSRS state (no changes needed - they stay as-is)

**1.2 `snoozeLessons(lessonIds: string[], until: Date)`**
- Bulk version for Library page bulk actions
- Applies snooze to all selected lessons

**1.3 `snoozeCategory(categoryName: string, until: Date)`**
- Sets `categoryData[].snoozedUntil = until.toISOString()`
- Snoozes all current lessons in that category

**1.4 `unsnoozeLesson(lessonId: string)`**
- Clears `lesson.snoozedUntil = undefined`

**1.5 `unsnoozeCategory(categoryName: string)`**
- Clears `categoryData[].snoozedUntil = undefined`
- Unsnoozes all lessons in that category

### Modify Existing Functions

**1.6 Update `getDueTodayLessons()` and `getMissedLessons()`**
- Filter out lessons where:
  - `lesson.snoozedUntil` is in the future, OR
  - `lesson.category` belongs to a snoozed category

**1.7 Add helper `isCategorySnoozed(categoryName: string)`**
- Returns `Date | null` for when snooze ends

**1.8 Add helper `isLessonSnoozed(lesson: Lesson)`**
- Checks both lesson-level and category-level snooze

---

## 2. LessonCard: Add Snooze Button (Tasks Page Only)

### Changes to LessonCard.tsx

**New Props:**
```text
showSnooze?: boolean          // Whether to show snooze button
onSnooze?: (id: string, until: Date) => void   // Snooze handler
isSnoozed?: boolean           // Show snoozed badge
snoozedUntil?: string         // For display
```

**UI Changes:**
- Add snooze button (Moon icon) to the 2x2 action grid when `showSnooze=true`
- Show "Snoozed until [date]" badge when lesson is snoozed
- Clicking snooze opens SnoozeDialog

### Changes to HomePage.tsx

Pass snooze props to LessonCard:
```text
showSnooze={true}
onSnooze={snoozeLesson}
```

---

## 3. BulkActionsBar: Add Snooze Option (Library Page)

### Changes to BulkActionsBar.tsx

**New Props:**
```text
onSnooze: (until: Date) => void   // Bulk snooze handler
```

**UI Changes:**
- Add Snooze button (Moon icon) between selected count and Merge button
- Available when 1+ lessons selected (unlike Merge which needs 2+)
- Clicking opens SnoozeDialog for bulk action

### Changes to LibraryPage.tsx

- Add `handleBulkSnooze` function using `snoozeLessons()`
- Pass handler to BulkActionsBar
- Add state for snooze dialog open/close

---

## 4. CategoryActionsDialog: Add Category Snooze

### UI Changes

Add a new section between Legacy Mode and Rename:

**When NOT snoozed:**
- "Snooze Category" button with Moon icon
- Clicking opens SnoozeDialog

**When snoozed:**
- Show "Snoozed until [date]" badge
- "Unsnooze" button to clear

### New Props

```text
isSnoozed?: boolean
snoozedUntil?: string
onSnooze: (categoryName: string, until: Date) => void
onUnsnooze: (categoryName: string) => void
```

### Changes to CategoriesPage.tsx

- Pass snooze props to CategoryActionsDialog
- Add snooze badge to category row when snoozed

---

## 5. Floating Add Button: Position & Drag-to-Reposition

### Changes to FloatingAddButton.tsx

**5.1 Fix Positioning**
```text
Current:  bottom-20 (80px fixed)
New:      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
```

**5.2 Remove RTL Position Flip**
```text
Remove:   const actualPosition = isRTL ? (position === 'left' ? 'right' : 'left') : position;
Keep:     Always use the raw `position` prop (defaults to 'right')
```

**5.3 Implement Drag-to-Reposition**

State:
```text
- isDragging: boolean
- dragPosition: { x: number, y: number }
- longPressTimer: NodeJS.Timeout | null
```

Touch handlers:
```text
onTouchStart:
  - Store initial touch position
  - Start 500ms long-press timer
  - On timer complete: set isDragging = true

onTouchMove:
  - If isDragging, update position to follow finger
  - Show visual feedback (scale 1.1, shadow)

onTouchEnd:
  - If was dragging:
    - Determine left/right based on which half of screen
    - Call updateSettings({ fabPosition: newPosition })
    - Reset dragging state
```

Visual feedback during drag:
```text
- Scale up to 1.1
- Add drop shadow
- Optional: Show ghost indicators on left/right edges
```

### New Props

```text
onPositionChange: (position: 'left' | 'right') => void
```

### Changes to Pages

Update HomePage, LibraryPage, CategoriesPage to pass:
```text
onPositionChange={(pos) => updateSettings({ fabPosition: pos })}
```

---

## 6. Translations: Complete Arabic

### Add to en.ts (bulk section)

```text
bulk: {
  ...existing,
  snooze: 'Snooze',
  snoozeSelected: 'Snooze {count} lessons',
}
```

### Add to ar.ts (bulk section)

```text
bulk: {
  ...existing,
  snooze: 'تأجيل',
  snoozeSelected: 'تأجيل {count} درس',
}
```

### Add to en.ts (categoryActions section)

```text
categoryActions: {
  ...existing,
  snoozeCategory: 'Snooze Category',
  categorySnoozedUntil: 'Snoozed until {date}',
}
```

### Add to ar.ts (categoryActions section)

```text
categoryActions: {
  ...existing,
  snoozeCategory: 'تأجيل التصنيف',
  categorySnoozedUntil: 'مؤجل حتى {date}',
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useLocalStorage.tsx` | Add snooze functions, update filtering |
| `src/components/LessonCard.tsx` | Add snooze props and button |
| `src/components/BulkActionsBar.tsx` | Add snooze button with dialog |
| `src/components/FloatingAddButton.tsx` | Fix position, remove RTL flip, add drag |
| `src/components/CategoryActionsDialog.tsx` | Add category snooze section |
| `src/components/SnoozeDialog.tsx` | Minor adjustments if needed |
| `src/pages/HomePage.tsx` | Pass snooze props to LessonCard |
| `src/pages/LibraryPage.tsx` | Handle bulk snooze |
| `src/pages/CategoriesPage.tsx` | Pass snooze props |
| `src/lib/translations/en.ts` | Add bulk snooze translations |
| `src/lib/translations/ar.ts` | Add bulk snooze translations |

---

## Implementation Order

1. **useLocalStorage.tsx** - Add all snooze functions and filtering
2. **SnoozeDialog.tsx** - Verify/adjust for different use cases
3. **LessonCard.tsx** - Add snooze button and badge
4. **HomePage.tsx** - Enable snooze on lesson cards
5. **BulkActionsBar.tsx** - Add snooze to bulk actions
6. **LibraryPage.tsx** - Handle bulk snooze
7. **CategoryActionsDialog.tsx** - Add category snooze
8. **CategoriesPage.tsx** - Pass category snooze props
9. **FloatingAddButton.tsx** - Fix positioning and add drag
10. **All pages using FAB** - Pass onPositionChange
11. **Translation files** - Add missing keys

---

## Technical Notes

### Snooze Logic Details

When a lesson is snoozed:
1. `snoozedUntil` is set to the chosen date
2. `nextReviewDate` is updated to match (so when snooze ends, it appears due)
3. `currentStage` and `fsrs` state remain unchanged (frozen)
4. Lesson is filtered out of due/missed lists until snooze ends

When category is snoozed:
1. `categoryData[].snoozedUntil` is set
2. All lessons in that category are effectively snoozed
3. New lessons added during snooze are NOT auto-snoozed (per user request)

### FAB Drag Implementation

The long-press detection uses a 500ms timer. If the user releases before 500ms, it's a regular tap (opens AddLessonDialog). If held 500ms+, drag mode activates.

During drag:
- Button follows finger with position:fixed and dynamic left/top
- On release, position snaps to left-4 or right-4 based on which side of screen center

Position is persisted immediately via `updateSettings({ fabPosition })`.
