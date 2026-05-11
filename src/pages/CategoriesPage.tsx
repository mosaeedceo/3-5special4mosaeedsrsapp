import { useState, useEffect, useMemo } from 'react';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useTranslation } from '@/hooks/useTranslation';
import { useUndoableActions } from '@/hooks/useUndoableActions';
import { useLocation, useNavigate } from 'react-router-dom';
import { LessonCard } from '@/components/LessonCard';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { EmptyState } from '@/components/EmptyState';
import { ExamCountdown } from '@/components/ExamCountdown';
import { CategoryActionsDialog } from '@/components/CategoryActionsDialog';
import { FolderOpen, ChevronRight, ChevronDown, BookOpen, Calendar, X, Settings2, GraduationCap, Infinity, Clock, PlayCircle, Library as LibraryIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const CategoriesPage = ({ inBrowse }: { inBrowse?: boolean } = {}) => {
  const { 
    data, 
    addLesson, 
    markLessonDone, 
    reviewLessonWithUndo,
    deleteLessonWithUndo,
    editLesson,
    duplicateLesson,
    resetLessonProgress,
    updateCategoryExamDate,
    getCategoryStats,
    renameCategoryWithUndo,
    deleteCategoryWithUndo,
    isCategoryMedicalBoard,
    toggleCategoryMedicalBoardModeWithUndo,
    isCategoryLegacyMode,
    toggleCategoryLegacyModeWithUndo,
    getCategoryLegacyIntervals,
    updateCategoryLegacyIntervals,
    isCategorySnoozed,
    snoozeCategoryWithUndo,
    unsnoozeCategoryWithUndo,
    getCategoryColor,
    updateCategoryColorWithUndo,
    updateSettings,
    getDueTodayLessons,
    getMissedLessons,
  } = useUndoableActions();

  const { isTabletMode, containerClass, gridClass } = useDisplayMode(data.settings.displayMode);
  const { t, isRTL } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Local state for expanded categories (not persisted)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  const [editingExamDate, setEditingExamDate] = useState<string | null>(null);
  const [examDateInput, setExamDateInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { scrollToCategory?: string } | null;
    if (state?.scrollToCategory) {
      const category = state.scrollToCategory;
      // Ensure category is expanded so it's visible
      setExpandedCategories(prev => new Set([...prev, category]));
      
      // Short delay to allow for expansion animation if any, then scroll
      setTimeout(() => {
        const element = document.getElementById(`category-${category}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.state]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSetExamDate = (category: string) => {
    if (examDateInput) {
      updateCategoryExamDate(category, examDateInput);
    }
    setEditingExamDate(null);
    setExamDateInput('');
  };

  const handleClearExamDate = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateCategoryExamDate(category, undefined);
  };

  // Compute due/missed counts per category
  const dueTodayByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    getDueTodayLessons().forEach(l => { map[l.category] = (map[l.category] || 0) + 1; });
    return map;
  }, [data.lessons]);

  const missedByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    getMissedLessons().forEach(l => { map[l.category] = (map[l.category] || 0) + 1; });
    return map;
  }, [data.lessons]);

  // Group lessons by category
  const lessonsByCategory = data.lessons.reduce((acc, lesson) => {
    if (!acc[lesson.category]) {
      acc[lesson.category] = [];
    }
    acc[lesson.category].push(lesson);
    return acc;
  }, {} as Record<string, typeof data.lessons>);

  const categories = Object.keys(lessonsByCategory);

  return (
    <div className={cn('min-h-screen bg-background pb-safe animate-fade-in', inBrowse && 'pb-floating-clearance')}>
      {/* Header */}
      <header className="bg-card border-b border-border px-4 pt-4 pb-2">
        <div className={cn(containerClass, 'mx-auto')}>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground text-xs font-medium">
              {t('categories.subtitle')}
            </span>
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            {t('categories.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('categories.lessonAcross', { lessons: data.lessons.length, categories: categories.length })}
          </p>
        </div>
      </header>

      <main className={cn(containerClass, 'mx-auto px-4 py-6')}>

        {categories.length === 0 ? (
          <EmptyState type="no-lessons" />
        ) : (
          <div className="space-y-3">
            {categories.map((category) => {
              const lessons = lessonsByCategory[category];
              const isExpanded = expandedCategories.has(category);
              const { completed, pending, daysUntilExam, showWarning } = getCategoryStats(category);
              const isMedBoard = isCategoryMedicalBoard(category);
              const isLegacy = isCategoryLegacyMode(category);
              const dueTodayCount = dueTodayByCategory[category] || 0;
              const missedCount = missedByCategory[category] || 0;
              const hasReviewable = dueTodayCount > 0 || missedCount > 0;

              return (
                <div key={category} id={`category-${category}`} className="animate-fade-in">
                  <div className="flex items-stretch gap-1.5 sm:gap-2">
                    <button
                      onClick={() => toggleCategory(category)}
                      className={cn(
                        'flex-1 flex items-center justify-between p-3 sm:p-4 rounded-lg border transition-all duration-200',
                        isMedBoard 
                          ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/40 hover:border-primary/60' 
                          : isLegacy
                            ? 'bg-gradient-to-r from-warning/10 to-warning/5 border-warning/40 hover:border-warning/60'
                            : showWarning 
                              ? 'bg-card border-warning/50 bg-warning/5' 
                              : 'bg-card border-border hover:border-primary/30'
                      )}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={cn(
                          'w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                          isMedBoard 
                            ? 'bg-primary/20' 
                            : isLegacy
                              ? 'bg-warning/20'
                              : showWarning 
                                ? 'bg-warning/20' 
                                : 'bg-primary/10'
                        )}>
                          {isMedBoard ? (
                            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          ) : isLegacy ? (
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                          ) : (
                            <BookOpen className={cn('w-4 h-4 sm:w-5 sm:h-5', showWarning ? 'text-warning' : 'text-primary')} />
                          )}
                        </div>
                        <div className={cn("min-w-0", isRTL ? "text-right" : "text-left")}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-heading font-semibold text-foreground text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
                              {category}
                            </h3>
                            {isMedBoard && (
                              <Infinity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                            )}
                            {isLegacy && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] h-4 px-1 text-warning border-warning/50 flex-shrink-0">
                                {t('lesson.legacyBadge')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] sm:text-sm text-muted-foreground truncate">
                            {isMedBoard 
                              ? `${lessons.length} ${t('categories.lessons', { count: lessons.length }).split(' ')[1] || ''} • ${t('categories.endless')}`
                              : `${lessons.length} ${t('categories.lessons', { count: lessons.length }).split(' ')[1] || ''} • ${completed}✓ • ${pending} ${t('categories.pending')}`
                            }
                          </p>
                          {!isMedBoard && lessons.length > 0 && (
                            <div className="hidden md:flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-success rounded-full transition-all duration-500"
                                  style={{ width: `${Math.round((completed / lessons.length) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                                {Math.round((completed / lessons.length) * 100)}%
                              </span>
                            </div>
                          )}
                          {hasReviewable && (
                            <div className={cn("flex items-center gap-1 mt-0.5 flex-wrap", isRTL && "flex-row-reverse")} onClick={e => e.stopPropagation()}>
                              {dueTodayCount > 0 && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                                  {t('categories.dueToday', { count: dueTodayCount })}
                                </span>
                              )}
                              {missedCount > 0 && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-danger/15 text-danger">
                                  {t('categories.missedCount', { count: missedCount })}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/', { state: { categoryFilter: category } });
                                }}
                                className="text-[10px] font-semibold text-primary hover:underline hidden md:flex items-center gap-0.5"
                              >
                                <PlayCircle className="w-3 h-3" />
                                {t('categories.reviewDue')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {daysUntilExam !== null && (
                          <ExamCountdown 
                            daysUntilExam={daysUntilExam} 
                            showWarning={showWarning}
                            compact 
                          />
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* View in Library Button (hidden on phones to keep card uncluttered) */}
                    <button
                      onClick={() => navigate('/library', { state: { categoryFilter: category } })}
                      className="hidden md:flex items-center justify-center w-10 sm:w-12 rounded-lg border border-border bg-card hover:border-primary/30 transition-all min-h-[44px]"
                      aria-label={t('categories.viewInLibrary') as string}
                      title={t('categories.viewInLibrary') as string}
                    >
                      <LibraryIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    </button>

                    {/* Category Edit Button */}
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="flex items-center justify-center w-10 sm:w-12 rounded-lg border border-border bg-card hover:border-primary/30 transition-all min-h-[44px]"
                    >
                      <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    </button>
                    
                    {/* Exam Date Button */}
                    <Dialog open={editingExamDate === category} onOpenChange={(open) => {
                      if (!open) {
                        setEditingExamDate(null);
                        setExamDateInput('');
                      }
                    }}>
                      <DialogTrigger asChild>
                        <button
                          onClick={() => {
                            const existingDate = data.categoryData.find(c => c.name === category)?.examDate;
                            setExamDateInput(existingDate || '');
                            setEditingExamDate(category);
                          }}
                          className={cn(
                            'flex items-center justify-center w-10 sm:w-12 rounded-lg border transition-all min-h-[44px]',
                            daysUntilExam !== null 
                              ? 'bg-primary/10 border-primary/30 hover:bg-primary/20' 
                              : 'bg-card border-border hover:border-primary/30'
                          )}
                        >
                          <Calendar className={cn(
                            'w-4 h-4 sm:w-5 sm:h-5',
                            daysUntilExam !== null ? 'text-primary' : 'text-muted-foreground'
                          )} />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)]">
                        <DialogHeader>
                          <DialogTitle className="font-heading">{t('categories.setExamDate')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <p className="text-sm text-muted-foreground">
                            {t('categories.setExamDate')} <strong>{category}</strong>
                          </p>
                          <Input
                            type="date"
                            value={examDateInput}
                            onChange={(e) => setExamDateInput(e.target.value)}
                            className="min-h-[44px]"
                          />
                          <div className="flex gap-2">
                            {daysUntilExam !== null && (
                              <Button 
                                variant="outline" 
                                className="flex-1 min-h-[44px]"
                                onClick={(e) => {
                                  handleClearExamDate(category, e);
                                  setEditingExamDate(null);
                                }}
                              >
                                <X className="w-4 h-4 mr-2" />
                                {t('actions.clear')}
                              </Button>
                            )}
                            <Button 
                              className="flex-1 min-h-[44px]"
                              onClick={() => handleSetExamDate(category)}
                            >
                              {t('actions.save')}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300',
                      isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className={cn('pt-3 grid', gridClass)}>
                      {lessons.map((lesson) => {
                        const intervals = lesson.customIntervals 
                          || (isLegacy ? getCategoryLegacyIntervals(lesson.category) : null)
                          || data.settings.intervals;
                        return (
                        <LessonCard
                          key={lesson.id}
                          lesson={lesson}
                          intervals={intervals}
                          onMarkDone={markLessonDone}
                          onReview={reviewLessonWithUndo}
                          onDelete={deleteLessonWithUndo}
                          onEdit={editLesson}
                          onDuplicate={duplicateLesson}
                          onResetProgress={resetLessonProgress}
                          categories={data.categories}
                          useFSRS={data.settings.useFSRS && !isLegacy}
                          desiredRetention={data.settings.desiredRetention}
                          medicalBoardMode={isMedBoard}
                          masteryStabilityDays={data.settings.masteryStabilityDays}
                          categoryColor={getCategoryColor(category)}
                          showEditButton
                          showAttachments
                          showDuplicate
                        />
                      );})}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Category Actions Dialog */}
        {editingCategory && (
          <CategoryActionsDialog
            open={!!editingCategory}
            onOpenChange={(open) => !open && setEditingCategory(null)}
            categoryName={editingCategory}
            lessonCount={lessonsByCategory[editingCategory]?.length || 0}
            isMedicalBoardMode={isCategoryMedicalBoard(editingCategory)}
            isLegacyMode={isCategoryLegacyMode(editingCategory)}
            legacyIntervals={getCategoryLegacyIntervals(editingCategory)}
            snoozedUntil={isCategorySnoozed(editingCategory)}
            onRename={renameCategoryWithUndo}
            onDelete={deleteCategoryWithUndo}
            onToggleMedicalBoardMode={toggleCategoryMedicalBoardModeWithUndo}
            onToggleLegacyMode={toggleCategoryLegacyModeWithUndo}
            onUpdateLegacyIntervals={updateCategoryLegacyIntervals}
            categoryColor={getCategoryColor(editingCategory)}
            onUpdateColor={updateCategoryColorWithUndo}
            onSnooze={snoozeCategoryWithUndo}
            onUnsnooze={unsnoozeCategoryWithUndo}
          />
        )}
      </main>

      {/* Floating Add Button */}
      <FloatingAddButton
        categories={data.categories}
        categoryData={data.categoryData}
        onAdd={addLesson}
        useFSRS={data.settings.useFSRS}
        position={data.settings.fabPosition || 'right'}
        coordinates={data.settings.fabCoordinates}
        onPositionChange={(pos, coords) => updateSettings({ fabPosition: pos, fabCoordinates: coords })}
      />
    </div>
  );
};
