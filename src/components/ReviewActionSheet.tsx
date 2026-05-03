import { useState, useEffect, useMemo } from 'react';
import { Lesson, FSRSRating } from '@/types/lesson';
import { getReviewOptions, formatInterval, calculateRetrievability } from '@/lib/fsrs';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { ProgressBar } from './ProgressBar';
import { DifficultyBadge } from './DifficultyBadge';
import { BookOpen, RotateCcw, Brain, Zap, Sparkles, X, GraduationCap, Infinity, Clock, TrendingUp, AlertTriangle, Shield, Activity, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ReviewActionSheetProps {
  lesson: Lesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: (lessonId: string, rating: FSRSRating) => void;
  intervals: number[];
  desiredRetention?: number;
  useFSRS?: boolean;
  medicalBoardMode?: boolean;
  masteryStabilityDays?: number;
  remainingLessons?: Lesson[];
  onSwitchToLesson?: (lesson: Lesson) => void;
}

const getRatingConfig = (t: (key: string) => string) => ({
  again: {
    label: t('ratings.again'),
    icon: RotateCcw,
    className: 'bg-danger/10 hover:bg-danger/20 text-danger border-danger/30',
    description: t('ratings.againDesc'),
  },
  hard: {
    label: t('ratings.hard'),
    icon: Brain,
    className: 'bg-warning/10 hover:bg-warning/20 text-warning border-warning/30',
    description: t('ratings.hardDesc'),
  },
  good: {
    label: t('ratings.good'),
    icon: Zap,
    className: 'bg-success/10 hover:bg-success/20 text-success border-success/30',
    description: t('ratings.goodDesc'),
  },
  easy: {
    label: t('ratings.easy'),
    icon: Sparkles,
    className: 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30',
    description: t('ratings.easyDesc'),
  },
});

export const ReviewActionSheet = ({
  lesson,
  open,
  onOpenChange,
  onReview,
  intervals,
  desiredRetention = 0.9,
  useFSRS = true,
  medicalBoardMode = false,
  masteryStabilityDays = 21,
  remainingLessons = [],
  onSwitchToLesson,
}: ReviewActionSheetProps) => {
  const [reviewOptions, setReviewOptions] = useState<Record<FSRSRating, { interval: number; label: string }> | null>(null);
  const [showNextSuggestion, setShowNextSuggestion] = useState(false);
  const [lastRating, setLastRating] = useState<FSRSRating | null>(null);
  const { t, isRTL } = useTranslation();
  const ratingConfig = getRatingConfig(t);
  const NavChevron = isRTL ? ChevronLeft : ChevronRight;

  // Calculate memory metrics for Medical Board Mode
  const memoryMetrics = useMemo(() => {
    if (!lesson?.fsrs) return null;
    
    const now = new Date();
    const lastReview = lesson.fsrs.lastReview 
      ? new Date(lesson.fsrs.lastReview) 
      : new Date(lesson.dateAdded);
    const elapsedDays = Math.max(0, Math.floor(
      (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    const retrievability = calculateRetrievability(lesson.fsrs.stability, elapsedDays);
    const retrievabilityPercent = Math.round(retrievability * 100);
    
    // Determine health status
    let healthStatus: 'strong' | 'good' | 'fading' | 'at-risk';
    let healthColor: string;
    let healthLabel: string;
    
    if (retrievabilityPercent >= 85) {
      healthStatus = 'strong';
      healthColor = 'text-success';
      healthLabel = t('memoryHealth.strong');
    } else if (retrievabilityPercent >= 70) {
      healthStatus = 'good';
      healthColor = 'text-primary';
      healthLabel = t('memoryHealth.good');
    } else if (retrievabilityPercent >= 50) {
      healthStatus = 'fading';
      healthColor = 'text-warning';
      healthLabel = t('memoryHealth.fading');
    } else {
      healthStatus = 'at-risk';
      healthColor = 'text-danger';
      healthLabel = t('memoryHealth.atRisk');
    }
    
    // Calculate next optimal review date
    const nextOptimalDays = Math.max(0, lesson.fsrs.scheduledDays - elapsedDays);
    
    return {
      retrievabilityPercent,
      elapsedDays,
      healthStatus,
      healthColor,
      healthLabel,
      nextOptimalDays,
      lastReviewDate: lastReview,
    };
  }, [lesson?.fsrs, lesson?.dateAdded, t]);

  useEffect(() => {
    if (lesson && useFSRS) {
      const options = getReviewOptions(lesson, desiredRetention);
      setReviewOptions(options);
    } else if (lesson && !useFSRS) {
      // Classic Mode: Show REAL stage-based intervals
      const currentStage = lesson.currentStage;
      // Get the actual intervals being used
      const actualIntervals = lesson.customIntervals || intervals;
      
      // Calculate real intervals based on stage movement
      // Again: -1 stage (or stay at 0), uses that stage's interval
      const againStage = Math.max(0, currentStage - 1);
      const againInterval = actualIntervals[againStage] || 1;
      
      // Hard: stay at current stage, repeat current interval
      const hardInterval = actualIntervals[Math.min(currentStage, actualIntervals.length - 1)] || 1;
      
      // Good: +1 stage
      const goodStage = currentStage + 1;
      const goodInterval = goodStage < actualIntervals.length 
        ? actualIntervals[goodStage] 
        : actualIntervals[actualIntervals.length - 1];
      
      // Easy: +2 stages
      const easyStage = currentStage + 2;
      const easyInterval = easyStage < actualIntervals.length 
        ? actualIntervals[easyStage] 
        : actualIntervals[actualIntervals.length - 1];
      
      setReviewOptions({
        again: { interval: againInterval, label: formatInterval(againInterval) },
        hard: { interval: hardInterval, label: formatInterval(hardInterval) },
        good: { interval: goodInterval, label: formatInterval(goodInterval) },
        easy: { interval: easyInterval, label: formatInterval(easyInterval) },
      });
    }
  }, [lesson, useFSRS, desiredRetention, intervals]);

  const nextLesson = useMemo(() => {
    if (!lesson) return null;
    const others = remainingLessons.filter(l => l.id !== lesson.id);
    if (others.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const missed = others.filter(l => {
      const rd = new Date(l.nextReviewDate);
      rd.setHours(0, 0, 0, 0);
      return rd < today;
    });
    return missed.length > 0 ? missed[0] : others[0];
  }, [lesson, remainingLessons]);

  useEffect(() => {
    if (!open) {
      setShowNextSuggestion(false);
      setLastRating(null);
    }
  }, [open]);

  if (!lesson) return null;

  const handleRating = (rating: FSRSRating) => {
    onReview(lesson.id, rating);
    setLastRating(rating);
    if (onSwitchToLesson && remainingLessons.length > 0) {
      setShowNextSuggestion(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleReviewNext = () => {
    if (nextLesson && onSwitchToLesson) {
      setShowNextSuggestion(false);
      setLastRating(null);
      onSwitchToLesson(nextLesson);
    }
  };

  const handleDone = () => {
    setShowNextSuggestion(false);
    setLastRating(null);
    onOpenChange(false);
  };

  const ratings: FSRSRating[] = ['again', 'hard', 'good', 'easy'];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className={cn("pb-2", isRTL ? "text-right" : "text-left")}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {medicalBoardMode ? (
                  <div className="flex items-center text-primary shrink-0">
                    <GraduationCap className="w-5 h-5" />
                    <Infinity className="w-3 h-3 -ml-0.5" />
                  </div>
                ) : (
                  <BookOpen className="w-5 h-5 text-primary shrink-0" />
                )}
                <DrawerTitle className="font-heading text-lg truncate">
                  {lesson.title}
                </DrawerTitle>
              </div>
              <DrawerDescription className="flex items-center gap-2 flex-wrap">
                <span>{lesson.category}</span>
                <span>•</span>
                <span>{lesson.subject}</span>
                <DifficultyBadge difficulty={lesson.difficulty} />
                {medicalBoardMode && (
                  <Badge variant="outline" className="text-xs border-primary/40 text-primary bg-primary/10">
                    {t('lesson.medicalBoard')}
                  </Badge>
                )}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0 -mt-1 -mr-2">
                <X className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </div>
          
          {/* Unified Memory Health Panel for FSRS */}
          {useFSRS && memoryMetrics && (
            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{t('memoryHealth.title')}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs font-semibold",
                    memoryMetrics.healthStatus === 'strong' && "border-success/50 text-success bg-success/10",
                    memoryMetrics.healthStatus === 'good' && "border-primary/50 text-primary bg-primary/10",
                    memoryMetrics.healthStatus === 'fading' && "border-warning/50 text-warning bg-warning/10",
                    memoryMetrics.healthStatus === 'at-risk' && "border-danger/50 text-danger bg-danger/10"
                  )}
                >
                  {memoryMetrics.healthStatus === 'at-risk' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {memoryMetrics.healthStatus === 'strong' && <Shield className="w-3 h-3 mr-1" />}
                  {memoryMetrics.healthLabel}
                </Badge>
              </div>
              
              {/* Recall Probability */}
              <div className="mb-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('memoryHealth.currentRecall')}</span>
                  <span className={cn("font-semibold", memoryMetrics.healthColor)}>
                    {memoryMetrics.retrievabilityPercent}%
                  </span>
                </div>
                <Progress 
                  value={memoryMetrics.retrievabilityPercent} 
                  className={cn(
                    "h-1.5",
                    memoryMetrics.healthStatus === 'strong' && "[&>div]:bg-success",
                    memoryMetrics.healthStatus === 'good' && "[&>div]:bg-primary",
                    memoryMetrics.healthStatus === 'fading' && "[&>div]:bg-warning",
                    memoryMetrics.healthStatus === 'at-risk' && "[&>div]:bg-danger"
                  )}
                />
              </div>
              
              {/* Memory Strength (Stability) - Only shown in Normal FSRS mode, not Medical Board Mode */}
              {!medicalBoardMode && lesson.fsrs && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{t('memoryHealth.memoryStrength')}</span>
                    <span className={lesson.fsrs.stability >= masteryStabilityDays ? 'text-success font-semibold' : 'font-semibold'}>
                      {lesson.fsrs.stability >= masteryStabilityDays 
                        ? `✓ ${t('progress.mastered')}` 
                        : `${Math.round(lesson.fsrs.stability)}d / ${masteryStabilityDays}d`
                      }
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((lesson.fsrs.stability / masteryStabilityDays) * 100, 100)} 
                    className={cn(
                      "h-1.5",
                      lesson.fsrs.stability >= masteryStabilityDays 
                        ? "[&>div]:bg-success" 
                        : "[&>div]:bg-primary/70"
                    )}
                  />
                </div>
              )}
              
              {/* Time Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {t('memoryHealth.lastReviewed')} {memoryMetrics.elapsedDays === 0 
                      ? t('memoryHealth.today') 
                      : t('memoryHealth.daysAgo', { days: memoryMetrics.elapsedDays })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>
                    {t('memoryHealth.nextOptimal')} {memoryMetrics.nextOptimalDays === 0 
                      ? t('memoryHealth.now') 
                      : t('memoryHealth.inDays', { days: memoryMetrics.nextOptimalDays })}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Legacy Progress for non-FSRS mode only */}
          {!useFSRS && !medicalBoardMode && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{t('progress.stage')}</span>
                <span>
                  {t('progress.stage')} {lesson.currentStage + 1} {t('progress.of')} {(lesson.customIntervals || intervals).length}
                </span>
              </div>
              <ProgressBar 
                current={lesson.currentStage} 
                total={(lesson.customIntervals || intervals).length}
                useFSRS={false}
                medicalBoardMode={false}
              />
            </div>
          )}

          {/* FSRS Stats */}
          {lesson.fsrs && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">{t('progress.stability')}</div>
                <div className="font-semibold text-sm">{formatInterval(Math.round(lesson.fsrs.stability))}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">{t('progress.reviews')}</div>
                <div className="font-semibold text-sm">{lesson.fsrs.reps}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">{t('progress.lapses')}</div>
                <div className="font-semibold text-sm">{lesson.fsrs.lapses}</div>
              </div>
            </div>
          )}
        </DrawerHeader>
        
        <DrawerFooter className="pt-4">
          {showNextSuggestion ? (
            <div className="animate-fade-in">
              {lastRating && (
                <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50">
                    {(() => {
                      const config = ratingConfig[lastRating];
                      const Icon = config.icon;
                      return <><Icon className="w-3.5 h-3.5" />{t('ratings.ratedAs', { label: config.label })}</>;
                    })()}
                  </span>
                </div>
              )}

              {nextLesson ? (
                <div className="space-y-3">
                  <div className="text-center text-sm font-medium text-foreground">
                    {t('ratings.upNext')}
                  </div>
                  <div 
                    className="p-3 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={handleReviewNext}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{nextLesson.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{nextLesson.category} • {nextLesson.subject}</p>
                      </div>
                      <NavChevron className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-10" onClick={handleDone}>
                      {t('ratings.done')}
                    </Button>
                    <Button className="flex-[2] h-10" onClick={handleReviewNext}>
                      {t('ratings.reviewNext')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t('ratings.allDoneForNow')}</p>
                    <p className="text-xs text-muted-foreground">{t('ratings.noMoreDue')}</p>
                  </div>
                  <Button className="w-full h-10" onClick={handleDone}>
                    {t('ratings.done')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="text-center text-sm text-muted-foreground mb-3">
                {t('ratings.howWellRemember')}
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {ratings.map((rating) => {
                  const config = ratingConfig[rating];
                  const Icon = config.icon;
                  const option = reviewOptions?.[rating];
                  
                  return (
                    <Button
                      key={rating}
                      variant="outline"
                      className={cn(
                        'flex flex-col items-center gap-1 h-auto py-3 px-2 border-2 transition-all',
                        config.className
                      )}
                      onClick={() => handleRating(rating)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-semibold text-sm">{config.label}</span>
                      {option && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                          {option.label}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
              
              <div className="grid grid-cols-4 gap-2 mt-1">
                {ratings.map((rating) => (
                  <div key={rating} className="text-[10px] text-center text-muted-foreground">
                    {ratingConfig[rating].description}
                  </div>
                ))}
              </div>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
