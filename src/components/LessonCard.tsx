import { memo, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, BookOpen, Paperclip, Copy, StickyNote, Infinity, AlertTriangle, GraduationCap, Brain, Hash, Moon, Layers } from 'lucide-react';
import { Lesson, FSRSRating } from '@/types/lesson';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { DifficultyBadge } from './DifficultyBadge';
import { ProgressBar } from './ProgressBar';
import { EditLessonDialog } from './EditLessonDialog';
import { AttachmentDialog } from './AttachmentDialog';
import { ReviewActionSheet } from './ReviewActionSheet';
import { SnoozeDialog } from './SnoozeDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { calculateRetrievability } from '@/lib/fsrs';
import { useTranslation } from '@/hooks/useTranslation';

interface LessonCardProps {
  lesson: Lesson;
  intervals: number[];
  onMarkDone: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, updates: Partial<Lesson>) => void;
  onReview?: (id: string, rating: FSRSRating) => void;
  onDuplicate?: (id: string) => void;
  onResetProgress?: (id: string) => void;
  onSnooze?: (id: string, until: Date) => void;
  categories?: string[];
  existingTags?: string[];
  isMissed?: boolean;
  showEditButton?: boolean;
  showAttachments?: boolean;
  showDuplicate?: boolean;
  showSnooze?: boolean;
  useFSRS?: boolean;
  desiredRetention?: number;
  medicalBoardMode?: boolean;
  masteryStabilityDays?: number;
  categoryColor?: string;
  remainingLessons?: Lesson[];
  onSwitchToLesson?: (lesson: Lesson) => void;
  showNextReviewDate?: boolean;
  lastRating?: FSRSRating;
}

const RATING_BADGE_STYLES: Record<FSRSRating, string> = {
  again: 'text-danger border-danger/40 bg-danger/10',
  hard: 'text-warning border-warning/40 bg-warning/10',
  good: 'text-success border-success/40 bg-success/10',
  easy: 'text-primary border-primary/40 bg-primary/10',
};

export const LessonCard = memo(({ 
  lesson, 
  intervals, 
  onMarkDone, 
  onDelete, 
  onEdit,
  onReview,
  onDuplicate,
  onResetProgress,
  onSnooze,
  categories = [],
  existingTags = [],
  isMissed,
  showEditButton = false,
  showAttachments = false,
  showDuplicate = false,
  showSnooze = false,
  useFSRS = true,
  desiredRetention = 0.9,
  medicalBoardMode = false,
  masteryStabilityDays = 21,
  categoryColor,
  remainingLessons = [],
  onSwitchToLesson,
  showNextReviewDate = false,
  lastRating,
}: LessonCardProps) => {
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const { t, formatDate } = useTranslation();
  const navigate = useNavigate();
  const { data: storeData } = useLocalStorage();
  const linkedDeck = lesson.linkedDeckId
    ? (storeData.decks || []).find(d => d.id === lesson.linkedDeckId)
    : undefined;
  
  // Memoize computed values to prevent recalculation on every render
  const { isToday, isCompleted, attachmentCount, hasNotes, stability, isAtRisk, retrievability, isSnoozed, dueLabel } = useMemo(() => {
    const reviewDate = new Date(lesson.nextReviewDate);
    const now = new Date();
    
    // Calculate retrievability for "at risk" warning
    let retrievabilityValue = 1;
    if (lesson.fsrs) {
      const lastReview = lesson.fsrs.lastReview 
        ? new Date(lesson.fsrs.lastReview) 
        : new Date(lesson.dateAdded);
      const elapsedDays = Math.max(0, Math.floor(
        (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
      ));
      retrievabilityValue = calculateRetrievability(lesson.fsrs.stability, elapsedDays);
    }
    
    // Check if lesson is currently snoozed
    const snoozedUntilDate = lesson.snoozedUntil ? new Date(lesson.snoozedUntil) : null;
    const lessonIsSnoozed = snoozedUntilDate ? snoozedUntilDate > now : false;

    // Calculate due label for upcoming lessons
    let upcomingLabel = '';
    const isTodayVal = now.toDateString() === reviewDate.toDateString();
    const isUpcoming = !lesson.completed && !isTodayVal && reviewDate > now;

    if (isUpcoming && showNextReviewDate) {
      const diffTime = reviewDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        upcomingLabel = t('progress.dueIn', { days: diffDays });
      } else {
        upcomingLabel = t('progress.dueOn', { 
          date: formatDate(reviewDate, { month: 'short', day: 'numeric' }) 
        });
      }
    }
    
    return {
      isToday: isTodayVal,
      isCompleted: lesson.completed,
      attachmentCount: lesson.attachments?.length || 0,
      hasNotes: !!lesson.notes?.trim(),
      stability: lesson.fsrs?.stability || 0,
      isAtRisk: retrievabilityValue < 0.7 && useFSRS,
      retrievability: Math.round(retrievabilityValue * 100),
      isSnoozed: lessonIsSnoozed,
      dueLabel: upcomingLabel,
    };
  }, [lesson.nextReviewDate, lesson.completed, lesson.attachments?.length, lesson.fsrs, lesson.notes, lesson.dateAdded, lesson.snoozedUntil, medicalBoardMode, showNextReviewDate, t, formatDate]);
  
  // Memoize callbacks to prevent creating new function references
  const handleCardClick = useCallback(() => {
    // In Medical Board Mode, completed is never true, so always allow review
    if (!lesson.completed || medicalBoardMode) {
      setReviewSheetOpen(true);
    }
  }, [lesson.completed, medicalBoardMode]);
  
  const handleReview = useCallback((lessonId: string, rating: FSRSRating) => {
    if (onReview) {
      onReview(lessonId, rating);
    } else {
      // Fallback to legacy markDone for "good" rating
      if (rating === 'good' || rating === 'easy') {
        onMarkDone(lessonId);
      }
    }
  }, [onReview, onMarkDone]);
  
  const handleDelete = useCallback(() => {
    onDelete(lesson.id);
  }, [onDelete, lesson.id]);
  
  const handleDuplicate = useCallback(() => {
    onDuplicate?.(lesson.id);
  }, [onDuplicate, lesson.id]);

  const handleSnooze = useCallback((until: Date) => {
    onSnooze?.(lesson.id, until);
  }, [onSnooze, lesson.id]);

  // In Medical Board Mode, show stability-based UI instead of completion
  const showAsCompleted = isCompleted && !medicalBoardMode;
  
  return (
    <>
      <Card 
        className={cn(
          'animate-slide-up transition-all duration-300 hover:shadow-md',
          (!showAsCompleted) && 'cursor-pointer hover:border-primary/50 active:scale-[0.98]',
          // At Risk styling - highest priority, always show warning gradient
          isAtRisk && 'border-warning/50 bg-gradient-to-r from-warning/10 to-warning/5',
          // States without category color - apply full background/border styling
          !isAtRisk && !categoryColor && isMissed && !medicalBoardMode && 'bg-danger/5',
          !isAtRisk && !categoryColor && showAsCompleted && 'opacity-60 bg-success/5 border-success/10',
          !isAtRisk && !categoryColor && medicalBoardMode && 'bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border-primary/40 shadow-sm',
          !isAtRisk && !categoryColor && isSnoozed && 'opacity-50 border-muted-foreground/20 bg-muted/30',
          // States WITH category color - preserve visual cues via ring/shadow instead of overriding background
          !isAtRisk && categoryColor && isMissed && !medicalBoardMode && '',
          !isAtRisk && categoryColor && showAsCompleted && 'opacity-60',
          !isAtRisk && categoryColor && isSnoozed && 'opacity-50'
        )}
        style={categoryColor && !isAtRisk ? {
          backgroundColor: `${categoryColor}15`,
          borderColor: `${categoryColor}40`,
        } : undefined}
        onClick={handleCardClick}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-heading font-semibold text-foreground truncate text-sm">
                  {lesson.title}
                </h3>
                {attachmentCount > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1 shrink-0 h-5">
                    <Paperclip className="w-3 h-3" />
                    {attachmentCount}
                  </Badge>
                )}
                {hasNotes && (
                  <Badge variant="secondary" className="text-xs gap-1 shrink-0 h-5">
                    <StickyNote className="w-3 h-3" />
                  </Badge>
                )}
                {/* Medical Board badge - only for Medical Board categories when not at risk */}
                {medicalBoardMode && !isAtRisk && (
                  <Badge variant="outline" className="text-xs gap-0.5 shrink-0 h-5 text-primary border-primary/40 bg-primary/10">
                    <GraduationCap className="w-3 h-3" />
                    <Infinity className="w-2.5 h-2.5" />
                  </Badge>
                )}
                {/* Memory health badge for all FSRS cards (non-Medical Board) */}
                {useFSRS && !medicalBoardMode && lesson.fsrs && !isAtRisk && (
                  <Badge variant="outline" className="text-xs gap-1 shrink-0 h-5 text-primary/70 border-primary/30 bg-primary/5">
                    <Brain className="w-3 h-3" />
                    {retrievability}%
                  </Badge>
                )}
                {/* At Risk warning - applies to all FSRS cards */}
                {isAtRisk && (
                  <Badge variant="outline" className="text-xs gap-1 shrink-0 h-5 text-warning border-warning/50 bg-warning/10 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    {retrievability}%
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[10px] sm:text-xs text-muted-foreground mt-1">
                <span className="truncate max-w-[80px] sm:max-w-none">{lesson.category}</span>
                <span className="opacity-50">•</span>
                <span className="truncate max-w-[80px] sm:max-w-none">{lesson.subject}</span>
                <div className="flex items-center gap-2 ml-auto sm:ml-0 rtl:ml-0 rtl:mr-auto sm:rtl:mr-0">
                  <DifficultyBadge difficulty={lesson.difficulty} />
                  {showAsCompleted && (
                    <span className="text-success font-bold text-xs">✓</span>
                  )}
                  {isMissed && !showAsCompleted && (
                    <span className="text-danger font-semibold">{t('progress.missed')}</span>
                  )}
                  {isToday && !isMissed && !showAsCompleted && (
                    <span className="text-primary font-semibold">{t('progress.due')}</span>
                  )}
                  {lastRating && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] h-5 px-1.5 font-semibold uppercase tracking-wide',
                        RATING_BADGE_STYLES[lastRating],
                      )}
                    >
                      {t(`ratings.${lastRating}`)}
                    </Badge>
                  )}
                  {dueLabel && (
                    <span className="hidden min-[390px]:inline bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold text-[10px] animate-fade-in whitespace-nowrap shadow-sm border border-primary/20">{dueLabel}</span>
                  )}
                </div>
              </div>

              {/* Linked deck chip */}
              {linkedDeck && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/flashcards/${linkedDeck.id}/review`);
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] h-5 px-1.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  aria-label={t('flashcards.openDeck')}
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[120px]">{linkedDeck.name}</span>
                </button>
              )}

              {/* Tags display */}
              {lesson.tags && lesson.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {lesson.tags.slice(0, 3).map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="text-[10px] h-4 px-1.5 gap-0.5"
                    >
                      <Hash className="w-2.5 h-2.5" />
                      {tag}
                    </Badge>
                  ))}
                  {lesson.tags.length > 3 && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      +{lesson.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              
              <div className="mt-2">
                <ProgressBar 
                  current={lesson.currentStage} 
                  total={intervals.length}
                  useFSRS={useFSRS}
                  medicalBoardMode={medicalBoardMode}
                  stability={stability}
                  masteryThreshold={masteryStabilityDays}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-1" onClick={(e) => e.stopPropagation()}>
              {showEditButton && onEdit && (
                <EditLessonDialog
                  lesson={lesson}
                  categories={categories}
                  existingTags={existingTags}
                  onEdit={onEdit}
                  onResetProgress={onResetProgress}
                  showAttachments={false}
                  globalIntervals={intervals}
                  useFSRS={useFSRS}
                />
              )}
              {showAttachments && onEdit && (
                <AttachmentDialog
                  lesson={lesson}
                  onEdit={onEdit}
                />
              )}
              {showDuplicate && onDuplicate && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={handleDuplicate}
                  aria-label={t('a11y.duplicateLesson')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
              {showSnooze && onSnooze && (
                <SnoozeDialog
                  title={lesson.title}
                  type="lesson"
                  onSnooze={handleSnooze}
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      aria-label={t('a11y.snoozeLesson')}
                    >
                      <Moon className="w-4 h-4" />
                    </Button>
                  }
                />
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    aria-label={t('a11y.deleteLesson')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('lesson.deleteLesson')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('lesson.deleteConfirm', { title: lesson.title })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('actions.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <ReviewActionSheet
        lesson={lesson}
        open={reviewSheetOpen}
        onOpenChange={setReviewSheetOpen}
        onReview={handleReview}
        intervals={intervals}
        useFSRS={useFSRS}
        desiredRetention={desiredRetention}
        medicalBoardMode={medicalBoardMode}
        masteryStabilityDays={masteryStabilityDays}
        remainingLessons={remainingLessons}
        onSwitchToLesson={onSwitchToLesson}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization - only re-render when truly needed
  return (
    prevProps.lesson.id === nextProps.lesson.id &&
    prevProps.lesson.title === nextProps.lesson.title &&
    prevProps.lesson.category === nextProps.lesson.category &&
    prevProps.lesson.subject === nextProps.lesson.subject &&
    prevProps.lesson.difficulty === nextProps.lesson.difficulty &&
    prevProps.lesson.currentStage === nextProps.lesson.currentStage &&
    prevProps.lesson.completed === nextProps.lesson.completed &&
    prevProps.lesson.nextReviewDate === nextProps.lesson.nextReviewDate &&
    prevProps.lesson.attachments?.length === nextProps.lesson.attachments?.length &&
    prevProps.lesson.notes === nextProps.lesson.notes &&
    prevProps.lesson.fsrs?.stability === nextProps.lesson.fsrs?.stability &&
    prevProps.lesson.snoozedUntil === nextProps.lesson.snoozedUntil &&
    prevProps.lesson.linkedDeckId === nextProps.lesson.linkedDeckId &&
    prevProps.lesson.tags?.length === nextProps.lesson.tags?.length &&
    (prevProps.lesson.tags?.every((tag, i) => tag === nextProps.lesson.tags?.[i]) ?? true) &&
    prevProps.isMissed === nextProps.isMissed &&
    prevProps.showEditButton === nextProps.showEditButton &&
    prevProps.showAttachments === nextProps.showAttachments &&
    prevProps.showDuplicate === nextProps.showDuplicate &&
    prevProps.showSnooze === nextProps.showSnooze &&
    prevProps.useFSRS === nextProps.useFSRS &&
    prevProps.medicalBoardMode === nextProps.medicalBoardMode &&
    prevProps.masteryStabilityDays === nextProps.masteryStabilityDays &&
    prevProps.intervals.length === nextProps.intervals.length &&
    prevProps.categories?.length === nextProps.categories?.length &&
    prevProps.existingTags?.length === nextProps.existingTags?.length &&
    prevProps.categoryColor === nextProps.categoryColor &&
    prevProps.remainingLessons?.length === nextProps.remainingLessons?.length &&
    prevProps.showNextReviewDate === nextProps.showNextReviewDate &&
    prevProps.lastRating === nextProps.lastRating
  );
});

LessonCard.displayName = 'LessonCard';
