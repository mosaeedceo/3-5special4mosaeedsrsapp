import { useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useTranslation } from '@/hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { EnhancedMasteryChart } from '@/components/EnhancedMasteryChart';
import { WeeklyProgressChart } from '@/components/WeeklyProgressChart';
import { StageDistributionChart } from '@/components/StageDistributionChart';
import { StabilityDistributionChart } from '@/components/StabilityDistributionChart';
import { DifficultyBreakdown } from '@/components/DifficultyBreakdown';
import { CategoryPerformance } from '@/components/CategoryPerformance';
import { MemoryStrengthGauge } from '@/components/MemoryStrengthGauge';
import { WeeklySummaryCard } from '@/components/WeeklySummaryCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Trophy, Target, TrendingUp, Flame, BookOpen, Layers, PieChart, Brain, GraduationCap, Infinity as InfinityIcon, Activity, CalendarDays, ChevronRight, ChevronLeft, BookMarked, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateRetrievability } from '@/lib/fsrs';
import { toLocalDateStr } from '@/lib/date';

export const StatsPage = () => {
  const { data, getMasteryStats, getTodayLessons, getMissedLessons, getDaysUntilExam, isCategoryMedicalBoard } = useLocalStorage();
  const { containerClass } = useDisplayMode(data.settings.displayMode);
  const { t, isRTL } = useTranslation();
  const navigate = useNavigate();
  const NavChevron = isRTL ? ChevronLeft : ChevronRight;
  
  const { completed, inProgress, total, masteryPercentage } = getMasteryStats();

  type StatsScope = 'lessons' | 'cards' | 'all';
  const [scope, setScope] = useState<StatsScope>('all');
  const masteryStabilityDays = data.settings.masteryStabilityDays ?? 21;
  const masteredCardsCount = useMemo(
    () => (data.cards || []).filter(c => (c.fsrs?.stability || 0) >= masteryStabilityDays).length,
    [data.cards, masteryStabilityDays],
  );

  // Count mature Medical Board lessons (stability >= 21) to include in displayed mastered total
  const matureMedBoardCount = useMemo(() => {
    return data.lessons.filter(l => {
      const cat = data.categoryData.find(c => c.name === l.category);
      return cat?.isMedicalBoardMode && (l.fsrs?.stability || 0) >= 21;
    }).length;
  }, [data.lessons, data.categoryData]);

  const lessonsMasteredTotal = completed + matureMedBoardCount;
  const displayMastered =
    scope === 'lessons' ? lessonsMasteredTotal
    : scope === 'cards' ? masteredCardsCount
    : lessonsMasteredTotal + masteredCardsCount;
  const todayCount = getTodayLessons().length;
  const missedCount = getMissedLessons().length;

  // Get Medical Board categories
  const medicalBoardCategories = useMemo(() => {
    return data.categoryData.filter(c => c.isMedicalBoardMode).map(c => c.name);
  }, [data.categoryData]);

  const hasMedicalBoardCategories = medicalBoardCategories.length > 0;

  // Calculate Medical Board stats for each category
  const medicalBoardStats = useMemo(() => {
    return medicalBoardCategories.map(categoryName => {
      const lessons = data.lessons.filter(l => l.category === categoryName);
      const totalLessons = lessons.length;
      
      const lessonsWithFSRS = lessons.filter(l => l.fsrs);
      const avgStability = lessonsWithFSRS.length > 0
        ? lessonsWithFSRS.reduce((sum, l) => sum + (l.fsrs?.stability || 0), 0) / lessonsWithFSRS.length
        : 0;
      
      const matureCount = lessons.filter(l => (l.fsrs?.stability || 0) >= 21).length;
      
      const atRiskCount = lessons.filter(l => {
        if (!l.fsrs) return false;
        const lastReview = l.fsrs.lastReview ? new Date(l.fsrs.lastReview) : new Date(l.dateAdded);
        const elapsedDays = Math.max(0, (Date.now() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
        return calculateRetrievability(l.fsrs.stability, elapsedDays) < 0.7;
      }).length;
      
      const avgRetrievability = lessonsWithFSRS.length > 0
        ? lessonsWithFSRS.reduce((sum, l) => {
            const lastReview = l.fsrs?.lastReview ? new Date(l.fsrs.lastReview) : new Date(l.dateAdded);
            const elapsedDays = Math.max(0, (Date.now() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
            return sum + calculateRetrievability(l.fsrs?.stability || 0, elapsedDays);
          }, 0) / lessonsWithFSRS.length
        : 0;
      
      return {
        name: categoryName,
        totalLessons,
        avgStability: Math.round(avgStability),
        matureCount,
        maturePercentage: totalLessons > 0 ? Math.round((matureCount / totalLessons) * 100) : 0,
        atRiskCount,
        avgRetrievability: Math.round(avgRetrievability * 100),
      };
    });
  }, [medicalBoardCategories, data.lessons]);

  // Calculate streak
  const calculateStreak = (): { current: number; best: number } => {
    if (data.activityHistory.length === 0) return { current: 0, best: 0 };
    
    const sortedHistory = [...data.activityHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedHistory.length; i++) {
      const recordDate = new Date(sortedHistory[i].date);
      recordDate.setHours(0, 0, 0, 0);
      
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);
      
      if (recordDate.getTime() === expectedDate.getTime() && sortedHistory[i].count > 0) {
        currentStreak++;
      } else if (i === 0 && recordDate.getTime() !== expectedDate.getTime()) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (recordDate.getTime() === yesterday.getTime() && sortedHistory[i].count > 0) {
          currentStreak = 1;
          continue;
        }
        break;
      } else {
        break;
      }
    }

    let bestStreak = currentStreak;
    let tempStreak = 0;
    const allDates = sortedHistory.map(h => h.date).sort();
    
    for (let i = 0; i < allDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = new Date(allDates[i - 1]);
        const currDate = new Date(allDates[i]);
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    }
    
    return { current: currentStreak, best: bestStreak };
  };

  const { current: streak, best: bestStreak } = calculateStreak();

  const avgDailyReviews = data.activityHistory.length > 0
    ? Math.round(data.activityHistory.reduce((sum, r) => sum + r.count, 0) / data.activityHistory.length)
    : 0;

  // Today's reviews breakdown: lessons vs flashcards (derived from reviewHistory timestamps)
  const todayReviewBreakdown = useMemo(() => {
    const todayStr = toLocalDateStr(new Date());
    let lessonReviews = 0;
    for (const lesson of data.lessons) {
      const history = lesson.reviewHistory || [];
      for (const entry of history) {
        if (toLocalDateStr(new Date(entry.date)) === todayStr) lessonReviews++;
      }
    }
    let cardReviews = 0;
    for (const card of data.cards || []) {
      const history = card.reviewHistory || [];
      for (const entry of history) {
        if (toLocalDateStr(new Date(entry.date)) === todayStr) cardReviews++;
      }
    }
    return { lessonReviews, cardReviews, total: lessonReviews + cardReviews };
  }, [data.lessons, data.cards]);

  // Get motivational message
  const getMotivation = () => {
    if (streak >= 30) return "🔥 " + t('stats.motivationIncredible');
    if (streak >= 14) return "💪 " + t('stats.motivationAmazing');
    if (streak >= 7) return "⭐ " + t('stats.motivationGreatWeek');
    if (streak >= 3) return "👍 " + t('stats.motivationNiceStreak');
    if (todayCount === 0 && missedCount === 0) return "✨ " + t('home.allCaughtUp');
    if (missedCount > 0) return "📚 " + t('stats.motivationCatchUp');
    return "🎯 " + t('stats.motivationReady');
  };

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary/10 via-card to-card border-b border-border px-4 pt-8 pb-4">
        <div className={cn(containerClass, 'mx-auto')}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground text-xs font-medium">
              {t('statsPage.analytics')}
            </span>
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            {t('stats.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {getMotivation()}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className={cn(containerClass, 'mx-auto px-4 py-6 space-y-6')}>
        {/* Scope toggle: Lessons / Cards / All */}
        <div className="flex justify-center animate-fade-in">
          <div
            role="tablist"
            aria-label="Stats scope"
            className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
          >
            {(['lessons', 'cards', 'all'] as const).map(s => (
              <button
                key={s}
                role="tab"
                aria-selected={scope === s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  scope === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`stats.scope${s.charAt(0).toUpperCase() + s.slice(1)}` as 'stats.scopeLessons' | 'stats.scopeCards' | 'stats.scopeAll')}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-fade-in">
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <Flame className={`w-5 h-5 mx-auto mb-1 ${streak > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
              <p className="text-xl font-heading font-bold text-foreground">{streak}</p>
              <p className="text-xs text-muted-foreground leading-tight">{t('statsPage.streak')}</p>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "transition-all",
              displayMastered > 0 && scope !== 'cards' && completed > 0 && "cursor-pointer hover:border-success/50 hover:shadow-sm active:scale-[0.97]",
              displayMastered > 0 && scope === 'cards' && masteredCardsCount > 0 && "cursor-pointer hover:border-success/50 hover:shadow-sm active:scale-[0.97]",
            )}
            onClick={() => {
              if (scope === 'cards') {
                if (masteredCardsCount > 0) navigate('/flashcards');
              } else if (completed > 0) {
                navigate('/library', { state: { initialStatusFilter: 'completed' } });
              }
            }}
          >
            <CardContent className="p-3 sm:p-4 text-center relative">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-success" />
              <p className="text-xl font-heading font-bold text-foreground">{displayMastered}</p>
              <p className="text-xs text-muted-foreground leading-tight">{t('stats.mastered')}</p>
              {scope === 'all' && masteredCardsCount > 0 && (
                <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-tight">+{masteredCardsCount} cards</p>
              )}
              {scope !== 'cards' && matureMedBoardCount > 0 && completed === 0 && (
                <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-tight">incl. {matureMedBoardCount} endless</p>
              )}
              {displayMastered > 0 && <NavChevron className="w-3 h-3 text-muted-foreground/50 absolute top-1 rtl:left-1 ltr:right-1" />}
            </CardContent>
          </Card>
          
          <Card 
            className={cn("transition-all", missedCount > 0 && "cursor-pointer hover:border-danger/50 hover:shadow-sm active:scale-[0.97]")}
            onClick={() => missedCount > 0 && navigate('/', { state: { scrollToMissed: true } })}
          >
            <CardContent className="p-3 sm:p-4 text-center relative">
              <BarChart3 className="w-5 h-5 mx-auto mb-1 text-danger" />
              <p className="text-xl font-heading font-bold text-foreground">{missedCount}</p>
              <p className="text-xs text-muted-foreground leading-tight">{t('statsPage.missed')}</p>
              {missedCount > 0 && <NavChevron className="w-3 h-3 text-muted-foreground/50 absolute top-1 rtl:left-1 ltr:right-1" />}
            </CardContent>
          </Card>

          <Card
            className={cn("transition-all", todayCount > 0 && "cursor-pointer hover:border-primary/50 hover:shadow-sm active:scale-[0.97]")}
            onClick={() => todayCount > 0 && navigate('/')}
          >
            <CardContent className="p-3 sm:p-4 text-center relative">
              <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xl font-heading font-bold text-foreground">{todayCount}</p>
              <p className="text-xs text-muted-foreground leading-tight">{t('statsPage.dueToday')}</p>
              {todayCount > 0 && <NavChevron className="w-3 h-3 text-muted-foreground/50 absolute top-1 rtl:left-1 ltr:right-1" />}
            </CardContent>
          </Card>

          <Card className="sm:col-span-3 lg:col-span-1">
            <CardContent className="p-3 sm:p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-accent" />
              <p className="text-xl font-heading font-bold text-foreground">{avgDailyReviews}</p>
              <p className="text-xs text-muted-foreground leading-tight">{t('statsPage.avgDay')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Streak info */}
        {bestStreak > 0 && (
          <div className="text-center text-sm text-muted-foreground animate-fade-in">
            {t('statsPage.bestStreak', { days: bestStreak })}
          </div>
        )}

        {/* Today's reviews breakdown: lessons vs flashcards */}
        {todayReviewBreakdown.total > 0 && (
          <Card className="animate-fade-in" style={{ animationDelay: '0.04s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('statsPage.todayReviews')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('statsPage.todayReviewsDesc', { count: todayReviewBreakdown.total })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookMarked className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-heading font-bold text-foreground leading-none">
                      {todayReviewBreakdown.lessonReviews}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {t('statsPage.lessonReviews')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Library className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-heading font-bold text-foreground leading-none">
                      {todayReviewBreakdown.cardReviews}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {t('statsPage.cardReviews')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Progress Chart */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <CardTitle className="font-heading text-base">{t('stats.weeklyProgress')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <WeeklyProgressChart activityHistory={data.activityHistory} />
          </CardContent>
        </Card>

        {/* Cards Summary — visible when scope includes cards */}
        {scope !== 'lessons' && (data.cards || []).length > 0 && (
          <Card className="animate-fade-in" style={{ animationDelay: '0.06s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('flashcards.title')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('stats.scopeCards')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const cards = data.cards || [];
                const total = cards.length;
                const now = Date.now();
                const due = cards.filter(c => !c.suspended && c.fsrs && c.fsrs.state !== 'new' && new Date(c.nextReviewDate).getTime() <= now).length;
                const mature = masteredCardsCount;
                const stabSum = cards.reduce((s, c) => s + (c.fsrs?.stability || 0), 0);
                const avgStab = total > 0 ? Math.round((stabSum / total) * 10) / 10 : 0;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-2 rounded-md bg-muted/40">
                      <div className="text-lg font-bold text-foreground">{total}</div>
                      <div className="text-[11px] text-muted-foreground">{t('flashcards.cardsCount', { count: total }).replace(/\d+\s*/, '')}</div>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40">
                      <div className="text-lg font-bold text-primary">{due}</div>
                      <div className="text-[11px] text-muted-foreground">{t('flashcards.due')}</div>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40">
                      <div className="text-lg font-bold text-success">{mature}</div>
                      <div className="text-[11px] text-muted-foreground">{t('statsPage.mastered')}</div>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40">
                      <div className="text-lg font-bold text-foreground">{avgStab}</div>
                      <div className="text-[11px] text-muted-foreground">{t('statsPage.avgStability', { days: '' }).trim()}</div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Memory Strength (scope-aware: lessons / cards / both) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="animate-fade-in" style={{ animationDelay: '0.07s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('memoryStrength.title')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('memoryStrength.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemoryStrengthGauge
                lessons={scope === 'cards' ? [] : data.lessons}
                cards={scope === 'lessons' ? undefined : (data.cards || [])}
              />
            </CardContent>
          </Card>

          {/* Weekly Summary (combined activity — visible in all scopes) */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.07s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('weeklySummary.title')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('weeklySummary.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklySummaryCard activityHistory={data.activityHistory} />
            </CardContent>
          </Card>
        </div>

        {/* Mastery & Difficulty - responsive grid (lesson-only) */}
        {scope !== 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Enhanced Mastery Chart */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('statsPage.learningProgress')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('statsPage.memoryHealthOverview')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedMasteryChart 
                lessons={data.lessons} 
                masteryThreshold={data.settings.masteryStabilityDays || 21}
              />
            </CardContent>
          </Card>

          {/* Difficulty Breakdown */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('statsPage.difficulty')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('statsPage.byDifficulty')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DifficultyBreakdown lessons={data.lessons} />
            </CardContent>
          </Card>
        </div>
        )}

        {/* Stage/Stability Distribution — FSRS chart is scope-aware; non-FSRS stage chart is lesson-only */}
        {(data.settings.useFSRS || scope !== 'cards') && (
        <Card className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {data.settings.useFSRS ? (
                <Brain className="w-4 h-4 text-primary" />
              ) : (
                <Layers className="w-4 h-4 text-primary" />
              )}
              <CardTitle className="font-heading text-base">
                {data.settings.useFSRS ? t('statsPage.memoryStrengthDistribution') : t('statsPage.learningPipeline')}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              {data.settings.useFSRS 
                ? t('statsPage.lessonsByStability', { days: data.settings.masteryStabilityDays || 21 })
                : t('statsPage.lessonsAtEachStage')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.settings.useFSRS ? (
              <StabilityDistributionChart
                lessons={scope === 'cards' ? [] : data.lessons}
                cards={scope === 'lessons' ? undefined : (data.cards || [])}
              />
            ) : (
              <StageDistributionChart 
                lessons={data.lessons} 
                intervals={data.settings.intervals} 
              />
            )}
          </CardContent>
        </Card>
        )}

        {/* Medical Board Categories Stats (lesson-only) */}
        {scope !== 'cards' && hasMedicalBoardCategories && (
          <Card className="animate-fade-in bg-gradient-to-br from-primary/5 to-transparent border-primary/30" style={{ animationDelay: '0.17s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('statsPage.medicalBoardCategories')}</CardTitle>
                <InfinityIcon className="w-3.5 h-3.5 text-primary" />
              </div>
              <CardDescription className="text-xs">
                {t('statsPage.endlessModeCategories')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {medicalBoardStats.map((stat) => (
                  <div 
                    key={stat.name}
                    className="p-3 rounded-lg border border-primary/20 bg-card/50 cursor-pointer hover:bg-muted/50 transition-colors group relative"
                    onClick={() => navigate('/categories', { state: { scrollToCategory: stat.name } })}
                    aria-label={t('statsPage.tapToViewCategory')}
                  >
                    <NavChevron className="w-3.5 h-3.5 text-muted-foreground/30 absolute top-3 rtl:left-3 ltr:right-3 group-hover:text-primary/50 transition-colors" />
                    <div className="flex items-center justify-between mb-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm truncate max-w-32">
                          {stat.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stat.totalLessons} {t('statsPage.lessons')}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        {stat.avgRetrievability}% {t('statsPage.recall')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${stat.maturePercentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground w-14 text-right">
                        {stat.maturePercentage}% {t('statsPage.mature')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        {t('statsPage.avgStability', { days: stat.avgStability })}
                      </span>
                      {stat.atRiskCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/library', { state: { initialStatusFilter: 'missed', categoryFilter: stat.name } });
                          }}
                          className="text-danger font-medium inline-flex items-center gap-0.5 hover:underline"
                        >
                          {stat.atRiskCount} {t('statsPage.atRisk')}
                          <NavChevron className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stability Distribution for Medical Board lessons only (lesson-only) */}
        {scope !== 'cards' && hasMedicalBoardCategories && (
          <Card className="animate-fade-in" style={{ animationDelay: '0.18s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('statsPage.medicalBoardMemory')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('statsPage.endlessModeLessons')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StabilityDistributionChart 
                lessons={data.lessons.filter(l => medicalBoardCategories.includes(l.category))} 
              />
            </CardContent>
          </Card>
        )}

        {/* Category Performance (lesson-only) */}
        {scope !== 'cards' && data.categories.length > 0 && (
          <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <CardTitle className="font-heading text-base">{t('statsPage.categoriesTitle')}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {t('statsPage.progressByCategory')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryPerformance 
                lessons={data.lessons}
                categories={data.categories}
                categoryData={data.categoryData}
                getDaysUntilExam={getDaysUntilExam}
                onCategoryClick={(category) => navigate('/categories', { state: { scrollToCategory: category } })}
              />
            </CardContent>
          </Card>
        )}

        {/* Activity Heatmap */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              <CardTitle className="font-heading text-base">{t('stats.activityHeatmap')} {new Date().getFullYear()}</CardTitle>
            </div>
            <CardDescription className="text-xs">
              {t('stats.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap activityHistory={data.activityHistory} />
          </CardContent>
        </Card>

      </main>
    </div>
  );
};
