import { useState, useMemo, useCallback } from 'react';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useTranslation } from '@/hooks/useTranslation';
import { useUndoableActions } from '@/hooks/useUndoableActions';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LessonCard } from '@/components/LessonCard';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { SearchFilters, StatusFilter, SortOption } from '@/components/SearchFilters';
import { EmptyState } from '@/components/EmptyState';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { MergeLessonsDialog } from '@/components/MergeLessonsDialog';
import { Library, BookOpen } from 'lucide-react';
import { Difficulty } from '@/types/lesson';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const LibraryPage = ({ inBrowse }: { inBrowse?: boolean } = {}) => {
  const {
    data,
    addLesson,
    markLessonDone,
    reviewLessonWithUndo,
    deleteLessonWithUndo,
    batchDeleteWithUndo,
    editLesson,
    resetLessonProgress,
    duplicateLesson,
    mergeLessons,
    isCategoryMedicalBoard,
    isCategoryLegacyMode,
    getCategoryLegacyIntervals,
    getCategoryColor,
    snoozeLessons,
    unsnoozeLessonWithUndo,
    updateSettings,
  } = useUndoableActions();

  const { isTabletMode, containerClass, gridClass } = useDisplayMode(data.settings.displayMode);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const useFSRS = data.settings.useFSRS;
  const desiredRetention = data.settings.desiredRetention || 0.9;

  const navState = location.state as { initialStatusFilter?: StatusFilter; categoryFilter?: string } | null;

  const SESSION_SORT_KEY = 'library-sort-preference';
  const SESSION_STATUS_KEY = 'library-status-preference';

  // Search query lives in the URL `?q=` param so it survives navigation and can be pre-set by deep links.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const setSearchQuery = useCallback((v: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (v) next.set('q', v); else next.delete('q');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [categoryFilter, setCategoryFilter] = useState(navState?.categoryFilter || 'all');
  const [bulkMode, setBulkMode] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    navState?.initialStatusFilter || (sessionStorage.getItem(SESSION_STATUS_KEY) as StatusFilter) || 'all'
  );
  const [tagFilter, setTagFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>(
    (sessionStorage.getItem(SESSION_SORT_KEY) as SortOption) || 'dueSoonest'
  );

  const handleSortChange = useCallback((sort: SortOption) => {
    setSortBy(sort);
    sessionStorage.setItem(SESSION_SORT_KEY, sort);
  }, []);

  const handleStatusFilterChange = useCallback((status: StatusFilter) => {
    setStatusFilter(status);
    if (!navState?.initialStatusFilter) {
      sessionStorage.setItem(SESSION_STATUS_KEY, status);
    }
  }, [navState?.initialStatusFilter]);
  
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get all unique tags from lessons
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    data.lessons.forEach(lesson => {
      lesson.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [data.lessons]);

  const hasActiveFilters = 
    searchQuery !== '' || 
    categoryFilter !== 'all' || 
    difficultyFilter !== 'all' || 
    statusFilter !== 'all' ||
    tagFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDifficultyFilter('all');
    handleStatusFilterChange('all');
    setTagFilter('all');
  };

  // Wrapper for addLesson that resets filter when adding future-dated lessons
  const handleAddLesson = useCallback((lesson: Parameters<typeof addLesson>[0]) => {
    addLesson(lesson);
    
    // If lesson is scheduled for the future, reset status filter
    // so the user can see their newly added lesson
    if (lesson.startDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(lesson.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      if (startDate > today && statusFilter !== 'all') {
        handleStatusFilterChange('all');
      }
    }
  }, [addLesson, statusFilter]);

  const toggleSelection = (id: string) => {
    setSelectedLessons(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedLessons(new Set());
    setBulkMode(false);
  };

  const handleBulkDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    batchDeleteWithUndo(Array.from(selectedLessons));
    clearSelection();
    setShowDeleteConfirm(false);
  };

  const handleMerge = (mergedData: {
    title: string;
    category: string;
    subject: string;
    difficulty: Difficulty;
    includeNotes: string[];
    includeAttachments: string[];
  }) => {
    mergeLessons(Array.from(selectedLessons), mergedData);
    clearSelection();
    setShowMergeDialog(false);
  };

  // Handle bulk snooze
  const handleBulkSnooze = useCallback((until: Date) => {
    snoozeLessons(Array.from(selectedLessons), until);
    clearSelection();
  }, [selectedLessons, snoozeLessons]);

  const handleBulkUnsnooze = useCallback(() => {
    Array.from(selectedLessons).forEach(id => unsnoozeLessonWithUndo(id));
    clearSelection();
  }, [selectedLessons, unsnoozeLessonWithUndo]);

  const hasSnoozedSelected = useMemo(() => {
    return Array.from(selectedLessons).some(id => {
      const lesson = data.lessons.find(l => l.id === id);
      if (!lesson) return false;
      
      const now = new Date();
      if (lesson.snoozedUntil && new Date(lesson.snoozedUntil) > now) return true;
      
      const categoryData = data.categoryData.find(c => c.name === lesson.category);
      if (categoryData?.snoozedUntil && new Date(categoryData.snoozedUntil) > now) return true;
      
      return false;
    });
  }, [selectedLessons, data.lessons, data.categoryData]);

  // Get selected lessons for merge dialog
  const selectedLessonObjects = useMemo(() => 
    data.lessons.filter(l => selectedLessons.has(l.id)), 
    [data.lessons, selectedLessons]
  );

  const filteredLessons = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = data.lessons.filter((lesson) => {
      // Search filter - includes title, subject, and tags
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = lesson.title.toLowerCase().includes(query);
        const matchesSubject = lesson.subject.toLowerCase().includes(query);
        const matchesTags = lesson.tags?.some(tag => tag.toLowerCase().includes(query)) ?? false;
        if (!matchesTitle && !matchesSubject && !matchesTags) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all' && lesson.category !== categoryFilter) {
        return false;
      }

      // Difficulty filter
      if (difficultyFilter !== 'all' && lesson.difficulty !== difficultyFilter) {
        return false;
      }

      // Tag filter
      if (tagFilter !== 'all') {
        if (!lesson.tags || !lesson.tags.includes(tagFilter)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const reviewDate = new Date(lesson.nextReviewDate);
        reviewDate.setHours(0, 0, 0, 0);

        switch (statusFilter) {
          case 'completed':
            if (!lesson.completed) return false;
            break;
          case 'due-today':
            if (lesson.completed || reviewDate.getTime() !== today.getTime()) return false;
            break;
          case 'missed':
            if (lesson.completed || reviewDate >= today) return false;
            break;
          case 'upcoming':
            if (lesson.completed || reviewDate <= today) return false;
            break;
          case 'snoozed': {
            const now = new Date();
            const lessonSnoozed = lesson.snoozedUntil && new Date(lesson.snoozedUntil) > now;
            const cat = data.categoryData.find(c => c.name === lesson.category);
            const categorySnoozed = cat?.snoozedUntil && new Date(cat.snoozedUntil) > now;
            if (!lessonSnoozed && !categorySnoozed) return false;
            break;
          }
        }
      }

      return true;
    });

    // Apply sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dueSoonest': {
          const aDate = new Date(a.nextReviewDate).getTime();
          const bDate = new Date(b.nextReviewDate).getTime();
          return aDate - bDate;
        }
        case 'titleAZ':
          return a.title.localeCompare(b.title);
        case 'newestFirst': {
          const aTime = new Date(a.dateAdded || a.nextReviewDate).getTime();
          const bTime = new Date(b.dateAdded || b.nextReviewDate).getTime();
          return bTime - aTime;
        }
        case 'memoryStrength': {
          const aStab = a.fsrs?.stability || 0;
          const bStab = b.fsrs?.stability || 0;
          return aStab - bStab;
        }
        default:
          return 0;
      }
    });
  }, [data.lessons, data.categoryData, searchQuery, categoryFilter, difficultyFilter, statusFilter, tagFilter, sortBy]);

  return (
    <div className={cn('min-h-screen bg-background pb-safe animate-fade-in', inBrowse && 'pb-floating-clearance')}>
      {/* Header */}
      <header className="bg-card border-b border-border px-4 pt-4 pb-2 md:pt-6 md:pb-4 lg:pt-8 lg:pb-4">
        <div className={cn(containerClass, 'mx-auto')}>
          <div className="flex items-center gap-2 mb-1">
            <Library className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground text-xs font-medium">
              {t('library.subtitle')}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-heading text-xl font-bold text-foreground">
              {t('library.title')}
            </h1>
            {data.lessons.length > 0 && (
              <button
                onClick={() => {
                  if (bulkMode) {
                    clearSelection();
                  } else {
                    setBulkMode(true);
                  }
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-card hover:border-primary/30 transition-all min-h-[32px]"
              >
                {bulkMode ? t('actions.cancel') : t('actions.edit')}
              </button>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {t('library.showing', { total: data.lessons.length, showing: filteredLessons.length })}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className={cn(containerClass, 'mx-auto px-4 py-4 pt-[4px] pb-[4px]')}>
        {/* Search & Filters */}
        <div className="mb-4">
          <SearchFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            difficultyFilter={difficultyFilter}
            onDifficultyChange={setDifficultyFilter}
            statusFilter={statusFilter}
            onStatusChange={handleStatusFilterChange}
            tagFilter={tagFilter}
            onTagChange={setTagFilter}
            sortBy={sortBy}
            onSortChange={isTabletMode ? handleSortChange : undefined}
            categories={data.categories}
            availableTags={allTags}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        {/* Lessons List */}
        {data.lessons.length === 0 ? (
          <EmptyState type="no-lessons" />
        ) : filteredLessons.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
              {t('library.noResults')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('library.noResultsDesc')}
            </p>
          </div>
        ) : (
          <div className={cn('grid', gridClass)}>
            {filteredLessons.map((lesson) => {
              const reviewDate = new Date(lesson.nextReviewDate);
              reviewDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isMissed = !lesson.completed && reviewDate < today;
              const isSelected = selectedLessons.has(lesson.id);

              const isLegacy = isCategoryLegacyMode(lesson.category);
              const intervals = lesson.customIntervals 
                || (isLegacy ? getCategoryLegacyIntervals(lesson.category) : null)
                || data.settings.intervals;

              return (
                <div key={lesson.id} className="flex items-start gap-2">
                  {bulkMode && (
                    <div className="flex-shrink-0 pt-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(lesson.id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        aria-label={`Select ${lesson.title}`}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <LessonCard
                      lesson={lesson}
                      intervals={intervals}
                      onMarkDone={markLessonDone}
                      onReview={reviewLessonWithUndo}
                      onDelete={deleteLessonWithUndo}
                      onEdit={editLesson}
                      onDuplicate={duplicateLesson}
                      onResetProgress={resetLessonProgress}
                      categories={data.categories}
                      existingTags={allTags}
                      isMissed={isMissed}
                      showEditButton
                      showAttachments
                      showDuplicate
                      useFSRS={useFSRS && !isLegacy}
                      desiredRetention={desiredRetention}
                      medicalBoardMode={isCategoryMedicalBoard(lesson.category)}
                      masteryStabilityDays={data.settings.masteryStabilityDays}
                      categoryColor={getCategoryColor(lesson.category)}
                      showNextReviewDate={true}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedLessons.size}
          onMerge={() => setShowMergeDialog(true)}
          onDelete={handleBulkDelete}
          onClearSelection={clearSelection}
          onSnooze={handleBulkSnooze}
          onUnsnooze={handleBulkUnsnooze}
          hasSnoozedSelected={hasSnoozedSelected}
        />

        {/* Merge Dialog */}
        <MergeLessonsDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          lessons={selectedLessonObjects}
          onMerge={handleMerge}
        />

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('bulk.deleteConfirm', { count: selectedLessons.size })}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('bulk.deleteDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmBulkDelete} className="bg-danger hover:bg-danger/90">
                {t('actions.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>

      {/* Floating Add Button */}
      <FloatingAddButton
        categories={data.categories}
        categoryData={data.categoryData}
        existingTags={allTags}
        onAdd={handleAddLesson}
        useFSRS={useFSRS}
        position={data.settings.fabPosition || 'right'}
        coordinates={data.settings.fabCoordinates}
        onPositionChange={(pos, coords) => updateSettings({ fabPosition: pos, fabCoordinates: coords })}
      />

    </div>
  );
};
