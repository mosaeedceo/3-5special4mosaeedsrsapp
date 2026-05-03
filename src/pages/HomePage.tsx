import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useTranslation } from '@/hooks/useTranslation';
import { useUndoableActions } from '@/hooks/useUndoableActions';
import { useLocation, useNavigate } from 'react-router-dom';
import { LessonCard } from '@/components/LessonCard';
import { CalendarStrip } from '@/components/CalendarStrip';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { EmptyState } from '@/components/EmptyState';
import { DailyQuote } from '@/components/DailyQuote';
import { ReviewActionSheet } from '@/components/ReviewActionSheet';
import { Sparkles, Flame, Trophy, CheckCircle2, Clock, Calendar, X } from 'lucide-react';
import { Lesson, FSRSRating, ReviewHistoryEntry } from '@/types/lesson';
import { cn } from '@/lib/utils';
import { toLocalDateStr } from '@/lib/date';

export const HomePage = () => {
  const { 
    data, 
    updateSettings, 
    getTodayLessons, 
    getMissedLessons, 
    reviewLessonWithUndo,
    isCategoryMedicalBoard,
    getCategoryColor,
    addLesson,
    isCategoryLegacyMode,
    markLessonDone,
    deleteLessonWithUndo,
    editLesson,
    duplicateLesson,
    resetLessonProgress,
  } = useUndoableActions();

  const { containerClass, gridClass } = useDisplayMode(data.settings.displayMode);
  const { t, formatDate } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const useFSRS = data.settings.useFSRS;
  const desiredRetention = data.settings.desiredRetention || 0.9;
  
  const todayLessons = getTodayLessons();
  const missedLessons = getMissedLessons();
  const totalDue = todayLessons.length + missedLessons.length;
  const allDueLessons = [...missedLessons, ...todayLessons];
  
  const missedSectionRef = useRef<HTMLDivElement>(null);

  // Read initial category filter from navigation state (from Categories page "Review →" button)
  const navState = location.state as { scrollToMissed?: boolean; categoryFilter?: string } | null;

  const [switchedLesson, setSwitchedLesson] = useState<Lesson | null>(null);
  const [switchedSheetOpen, setSwitchedSheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(navState?.categoryFilter || 'all');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isSelectedToday = selectedDate.getTime() === today.getTime();

  // Streak calculation
  const streak = useMemo(() => {
    if (data.activityHistory.length === 0) return 0;
    const sortedHistory = [...data.activityHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    let currentStreak = 0;
    const checkDate = new Date(today);
    for (let i = 0; i < sortedHistory.length; i++) {
      const recordDate = new Date(sortedHistory[i].date);
      recordDate.setHours(0, 0, 0, 0);
      if (recordDate.getTime() === checkDate.getTime() && sortedHistory[i].count > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (recordDate.getTime() === checkDate.getTime() && sortedHistory[i].count > 0) {
          currentStreak = 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return currentStreak;
  }, [data.activityHistory, today]);

  // Session progress
  // Note: activityHistory is incremented by both reviewLesson AND reviewCard
  // (see useLocalStorage's recordActivity), so this counter, the streak,
  // the activity heatmap, and the weekly progress chart all naturally
  // include flashcard reviews alongside lesson reviews.
  const reviewedToday = useMemo(() => {
    const todayStr = toLocalDateStr(today);
    return data.activityHistory.find(a => a.date === todayStr)?.count ?? 0;
  }, [data.activityHistory, today]);

  // Today's reviews split into lessons vs flashcards (derived from per-item
  // reviewHistory timestamps so we can show users a breakdown without
  // changing the activity-history schema).
  const reviewedTodayBreakdown = useMemo(() => {
    const todayStr = toLocalDateStr(today);
    let lessonReviews = 0;
    for (const lesson of data.lessons) {
      for (const entry of lesson.reviewHistory || []) {
        if (toLocalDateStr(new Date(entry.date)) === todayStr) lessonReviews++;
      }
    }
    let cardReviews = 0;
    for (const card of data.cards || []) {
      for (const entry of card.reviewHistory || []) {
        if (toLocalDateStr(new Date(entry.date)) === todayStr) cardReviews++;
      }
    }
    return { lessonReviews, cardReviews };
  }, [data.lessons, data.cards, today]);

  const sessionTotal = reviewedToday + totalDue;
  const progressPercent = sessionTotal > 0 ? (reviewedToday / sessionTotal) * 100 : 0;

  // Scroll to missed section if navigated from Stats
  useEffect(() => {
    if (navState?.scrollToMissed && missedSectionRef.current) {
      setTimeout(() => {
        missedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    // Pre-select category from navigation state
    if (navState?.categoryFilter) {
      setSelectedCategory(navState.categoryFilter);
    }
  }, [location.state]);

  const handleSwitchToLesson = useCallback((lesson: Lesson) => {
    setSwitchedLesson(lesson);
    setSwitchedSheetOpen(true);
  }, []);

  const handleSwitchedReview = useCallback((lessonId: string, rating: FSRSRating) => {
    reviewLessonWithUndo(lessonId, rating);
  }, [reviewLessonWithUndo]);

  const dateString = formatDate(isSelectedToday ? new Date() : selectedDate, { weekday: 'long', month: 'long', day: 'numeric' });

  // --- Date Filtering ---
  const dateFilteredLessons = useMemo(() => {
    const selectedTime = selectedDate.getTime();
    return data.lessons.filter(lesson => {
      if (lesson.completed) return false;
      const reviewDate = new Date(lesson.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      
      if (isSelectedToday) {
        // Normal view: show missed + today
        return reviewDate.getTime() <= selectedTime;
      } else if (selectedDate < today) {
        // Past date: show lessons that were due then (missed)
        return reviewDate.getTime() === selectedTime;
      } else {
        // Future date: show lessons due on that specific day
        return reviewDate.getTime() === selectedTime;
      }
    });
  }, [data.lessons, selectedDate, today, isSelectedToday]);

  // --- T006: Category filter chips ---
  const categoryChips = useMemo(() => {
    const cats = new Set<string>();
    [...todayLessons, ...missedLessons].forEach(l => cats.add(l.category));
    return Array.from(cats);
  }, [todayLessons, missedLessons]);

  const showCategoryChips = isSelectedToday && categoryChips.length >= 2;

  const filteredToday = useMemo(() => {
    if (!isSelectedToday && selectedDate < today) return [];
    const lessons = isSelectedToday ? todayLessons : dateFilteredLessons;
    return selectedCategory === 'all' ? lessons : lessons.filter(l => l.category === selectedCategory);
  }, [todayLessons, dateFilteredLessons, selectedCategory, isSelectedToday, selectedDate, today]);

  const filteredMissed = useMemo(() => {
    // Only show missed section when viewing "Today"
    if (!isSelectedToday) return [];
    return selectedCategory === 'all' ? missedLessons : missedLessons.filter(l => l.category === selectedCategory);
  }, [missedLessons, selectedCategory, isSelectedToday]);

  const pastDateReviewedLessons = useMemo<{ lesson: Lesson; lastRating: FSRSRating }[]>(() => {
    if (isSelectedToday || selectedDate >= today) return [];
    const targetStr = toLocalDateStr(selectedDate);
    const result: { lesson: Lesson; lastRating: FSRSRating }[] = [];
    data.lessons.forEach(lesson => {
      const entriesOnDay = (lesson.reviewHistory || []).filter(
        (entry: ReviewHistoryEntry) => toLocalDateStr(new Date(entry.date)) === targetStr
      );
      if (entriesOnDay.length === 0) return;
      // Most recent rating on that day (latest by timestamp)
      const sorted = [...entriesOnDay].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      result.push({ lesson, lastRating: sorted[sorted.length - 1].rating });
    });
    return result;
  }, [data.lessons, selectedDate, isSelectedToday, today]);

  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryChips.forEach(cat => {
      counts[cat] =
        todayLessons.filter(l => l.category === cat).length +
        missedLessons.filter(l => l.category === cat).length;
    });
    return counts;
  }, [categoryChips, todayLessons, missedLessons]);

  const masteredCategories = useMemo(() => {
    const masteryThreshold = data.settings.masteryStabilityDays || 21;
    const result: string[] = [];

    const lessonsByCategory: Record<string, typeof data.lessons> = {};
    data.lessons.forEach(lesson => {
      if (!lessonsByCategory[lesson.category]) {
        lessonsByCategory[lesson.category] = [];
      }
      lessonsByCategory[lesson.category].push(lesson);
    });

    Object.entries(lessonsByCategory).forEach(([category, lessons]) => {
      if (lessons.length < 2) return;
      const catData = data.categoryData.find(c => c.name === category);
      if (catData?.isMedicalBoardMode) return;
      const isLegacy = catData?.isLegacyMode;
      const allMastered = lessons.every(lesson => {
        if (isLegacy) return lesson.completed;
        if (useFSRS) return (lesson.fsrs?.stability || 0) >= masteryThreshold;
        return lesson.completed;
      });
      if (allMastered) result.push(category);
    });

    return result;
  }, [data.lessons, data.categoryData, data.settings.masteryStabilityDays, useFSRS]);

  return (
    <div className="min-h-screen bg-background pb-safe animate-fade-in">
      <header className="px-4 pt-8 pb-5 transition-colors duration-300 gradient-primary relative overflow-hidden">
        <div className={cn(containerClass, 'mx-auto relative z-10')}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-foreground/80" />
              <span className="text-xs font-medium text-primary-foreground/80">
                {dateString}
              </span>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30 backdrop-blur-sm animate-fade-in">
                <Flame className="w-3.5 h-3.5 fill-current text-orange-400" />
                <span className="text-xs font-bold">{streak}</span>
              </div>
            )}
          </div>
          <h1 className="font-heading text-xl font-bold text-primary-foreground">
            {t('home.todayReviews')}
          </h1>


          {reviewedToday > 0 && (
            <div className="mt-4 space-y-1.5 animate-fade-in">
              <div className="h-1.5 w-full bg-primary-foreground/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-foreground rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-primary-foreground/80">
                <span>{t('home.reviewedToday', { count: reviewedToday })}</span>
                <span>{t('home.ofTotal', { current: reviewedToday, total: sessionTotal })}</span>
              </div>
              {reviewedTodayBreakdown.cardReviews > 0 && (
                <div className="text-[10px] font-medium text-primary-foreground/70">
                  {t('home.reviewedBreakdown', {
                    lessons: reviewedTodayBreakdown.lessonReviews,
                    cards: reviewedTodayBreakdown.cardReviews,
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary-foreground/5 rounded-full -ml-12 -mb-12 blur-xl" />
      </header>

      <main className={cn(containerClass, 'mx-auto px-4 -mt-4')}>
        <DailyQuote />

        <div className="mb-6 hidden min-[390px]:block">
          <CalendarStrip 
            lessons={data.lessons}
            activityHistory={data.activityHistory}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
        </div>

        {data.lessons.length === 0 ? (
          <EmptyState type="no-lessons" />
        ) : isSelectedToday && totalDue === 0 ? (
          <div className="space-y-4 animate-fade-in">
            {/* Celebration card */}
            <div className="rounded-2xl border border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-1">
                {t('empty.allDone')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('empty.allDoneDesc')}
              </p>
              <div className="flex items-center justify-center gap-6">
                {reviewedToday > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-heading font-bold text-success">{reviewedToday}</p>
                    <p className="text-xs text-muted-foreground">{t('home.reviewedLabel')}</p>
                  </div>
                )}
                {streak > 0 && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-5 h-5 text-orange-400 fill-current" />
                      <p className="text-xl font-heading font-bold text-foreground">{streak}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('stats.dayStreak')}</p>
                  </div>
                )}
                {(() => {
                  const nextLesson = data.lessons
                    .filter(l => !l.completed)
                    .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime())[0];
                  if (!nextLesson) return null;
                  const nextDate = new Date(nextLesson.nextReviewDate);
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const isTomorrow = nextDate.toDateString() === tomorrow.toDateString();
                  return (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4 text-primary" />
                        <p className="text-sm font-heading font-bold text-foreground">
                          {isTomorrow ? t('home.tomorrow') : formatDate(nextDate, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('home.nextReview')}</p>
                    </div>
                  );
                })()}
              </div>
            </div>
            {masteredCategories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-success" />
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    {t('home.masteredCategories')}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {masteredCategories.map(category => (
                    <button
                      key={category}
                      onClick={() => navigate('/categories', { state: { scrollToCategory: category } })}
                      className="px-3 py-1.5 rounded-full border border-success/30 bg-success/5 text-success text-xs font-medium animate-in zoom-in-95 duration-300 hover:bg-success/10 transition-colors"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            {/* Category Filter Chips */}
            {showCategoryChips && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sticky top-0 bg-background/80 backdrop-blur-md z-20 border-b border-border/50 sm:border-none sm:bg-transparent sm:static">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    selectedCategory === 'all' 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {t('home.allCategories')}
                  <span className={cn(
                    "ml-1.5 px-1 rounded-full text-[10px]",
                    selectedCategory === 'all' ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
                  )}>
                    {totalDue}
                  </span>
                </button>
                {categoryChips.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(prev => prev === category ? 'all' : category)}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      selectedCategory === category 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {category}
                    <span className={cn(
                      "ml-0.5 px-1 rounded-full text-[10px]",
                      selectedCategory === category ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
                    )}>
                      {chipCounts[category]}
                    </span>
                    {selectedCategory === category && (
                      <X className="w-3 h-3 ml-0.5 opacity-70" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {filteredMissed.length > 0 && (
              <section ref={missedSectionRef} className="animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="font-heading font-bold text-danger flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                    {t('home.missedLessons')}
                  </h2>
                  <span className="text-xs font-medium text-danger/70 bg-danger/10 px-2 py-0.5 rounded-full">
                    {filteredMissed.length}
                  </span>
                </div>
                <div className={cn('grid', gridClass)}>
                  {filteredMissed.map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      intervals={lesson.customIntervals || data.settings.intervals}
                      onMarkDone={markLessonDone}
                      onReview={reviewLessonWithUndo}
                      onDelete={deleteLessonWithUndo}
                      onEdit={editLesson}
                      onDuplicate={duplicateLesson}
                      onResetProgress={resetLessonProgress}
                      categories={data.categories}
                      isMissed
                      useFSRS={useFSRS && !isCategoryLegacyMode(lesson.category)}
                      desiredRetention={desiredRetention}
                      medicalBoardMode={isCategoryMedicalBoard(lesson.category)}
                      masteryStabilityDays={data.settings.masteryStabilityDays}
                      categoryColor={getCategoryColor(lesson.category)}
                      remainingLessons={allDueLessons}
                      onSwitchToLesson={handleSwitchToLesson}
                      showNextReviewDate={true}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past date: reviewed lesson history */}
            {!isSelectedToday && selectedDate < today && (
              <section className="animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="font-heading font-bold text-success flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </h2>
                  {pastDateReviewedLessons.length > 0 && (
                    <span className="text-xs font-medium text-success/70 bg-success/10 px-2 py-0.5 rounded-full">
                      {t('home.calendarReviewedOn', { count: pastDateReviewedLessons.length })}
                    </span>
                  )}
                </div>
                {pastDateReviewedLessons.length > 0 ? (
                  <div className={cn('grid', gridClass)}>
                    {pastDateReviewedLessons.map(({ lesson, lastRating }) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        intervals={lesson.customIntervals || data.settings.intervals}
                        onMarkDone={markLessonDone}
                        onReview={reviewLessonWithUndo}
                        onDelete={deleteLessonWithUndo}
                        onEdit={editLesson}
                        onDuplicate={duplicateLesson}
                        onResetProgress={resetLessonProgress}
                        categories={data.categories}
                        useFSRS={useFSRS && !isCategoryLegacyMode(lesson.category)}
                        desiredRetention={desiredRetention}
                        medicalBoardMode={isCategoryMedicalBoard(lesson.category)}
                        masteryStabilityDays={data.settings.masteryStabilityDays}
                        categoryColor={getCategoryColor(lesson.category)}
                        showNextReviewDate={true}
                        lastRating={lastRating}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <Calendar className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('home.calendarNothingOn')}</p>
                  </div>
                )}
              </section>
            )}

            {filteredToday.length > 0 && (
              <section className="animate-in slide-in-from-bottom-2 duration-500 delay-100">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="font-heading font-bold text-primary flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {isSelectedToday ? t('home.dueToday') : formatDate(selectedDate, { month: 'short', day: 'numeric' })}
                  </h2>
                  <span className="text-xs font-medium text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
                    {filteredToday.length}
                  </span>
                </div>
                <div className={cn('grid', gridClass)}>
                  {filteredToday.map((lesson) => {
                    const reviewDate = new Date(lesson.nextReviewDate);
                    reviewDate.setHours(0, 0, 0, 0);
                    const isActuallyMissed = reviewDate < today && !lesson.completed;

                    return (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        intervals={lesson.customIntervals || data.settings.intervals}
                        onMarkDone={markLessonDone}
                        onReview={reviewLessonWithUndo}
                        onDelete={deleteLessonWithUndo}
                        onEdit={editLesson}
                        onDuplicate={duplicateLesson}
                        onResetProgress={resetLessonProgress}
                        categories={data.categories}
                        isMissed={isActuallyMissed}
                        useFSRS={useFSRS && !isCategoryLegacyMode(lesson.category)}
                        desiredRetention={desiredRetention}
                        medicalBoardMode={isCategoryMedicalBoard(lesson.category)}
                        masteryStabilityDays={data.settings.masteryStabilityDays}
                        categoryColor={getCategoryColor(lesson.category)}
                        remainingLessons={allDueLessons}
                        onSwitchToLesson={handleSwitchToLesson}
                        showNextReviewDate={true}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* T012: Category filter shows nothing due — only on today view */}
            {isSelectedToday && filteredMissed.length === 0 && filteredToday.length === 0 && selectedCategory !== 'all' && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Calendar className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground mb-1">
                  {t('home.noDueInCategory') || `Nothing due in "${selectedCategory}"`}
                </h3>
                {(() => {
                  const nextInCat = data.lessons
                    .filter(l => l.category === selectedCategory && !l.completed)
                    .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime())[0];
                  if (!nextInCat) return <p className="text-sm text-muted-foreground">{t('home.allMasteredInCategory')}</p>;
                  const nextDate = new Date(nextInCat.nextReviewDate);
                  return (
                    <p className="text-sm text-muted-foreground">
                      {t('home.nextReviewDate')}{' '}
                      <span className="font-medium text-primary">
                        {formatDate(nextDate, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </p>
                  );
                })()}
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="mt-3 text-xs text-primary hover:underline font-medium"
                >
                  {t('home.showAllCategories')}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <FloatingAddButton
        categories={data.categories}
        categoryData={data.categoryData}
        onAdd={addLesson}
        useFSRS={useFSRS}
        position={data.settings.fabPosition || 'right'}
        coordinates={data.settings.fabCoordinates}
        onPositionChange={(pos, coords) => updateSettings({ fabPosition: pos, fabCoordinates: coords })}
      />

      {switchedLesson && (
        <ReviewActionSheet
          open={switchedSheetOpen}
          onOpenChange={setSwitchedSheetOpen}
          lesson={switchedLesson}
          onReview={handleSwitchedReview}
          useFSRS={useFSRS && !isCategoryLegacyMode(switchedLesson.category)}
          desiredRetention={desiredRetention}
        />
      )}
    </div>
  );
};
