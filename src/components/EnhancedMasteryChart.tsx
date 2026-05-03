import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Lesson } from '@/types/lesson';
import { calculateRetrievability } from '@/lib/fsrs';
import { useTranslation } from '@/hooks/useTranslation';
import { Brain, TrendingUp, AlertTriangle } from 'lucide-react';

interface EnhancedMasteryChartProps {
  lessons: Lesson[];
  masteryThreshold: number;
}

interface LessonCategory {
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

export const EnhancedMasteryChart = ({ lessons, masteryThreshold }: EnhancedMasteryChartProps) => {
  const { t } = useTranslation();
  
  const stats = useMemo(() => {
    if (lessons.length === 0) {
      return {
        memoryScore: 0,
        categories: [] as LessonCategory[],
        atRiskCount: 0,
        avgRetrievability: 0,
        avgStability: 0,
      };
    }

    let totalRetrievability = 0;
    let totalStability = 0;
    let mastered = 0;
    let strong = 0;
    let learning = 0;
    let weak = 0;
    let atRisk = 0;

    lessons.forEach(lesson => {
      const stability = lesson.fsrs?.stability || 0;
      const lastReview = lesson.fsrs?.lastReview 
        ? new Date(lesson.fsrs.lastReview) 
        : new Date(lesson.dateAdded);
      const elapsedDays = Math.max(0, (Date.now() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
      const retrievability = lesson.fsrs 
        ? calculateRetrievability(stability, elapsedDays) 
        : 0;

      totalRetrievability += retrievability;
      totalStability += stability;

      // Categorize by stability relative to mastery threshold
      const stabilityRatio = stability / masteryThreshold;
      
      if (stabilityRatio >= 1) {
        mastered++;
      } else if (stabilityRatio >= 0.6) {
        strong++;
      } else if (stabilityRatio >= 0.3) {
        learning++;
      } else {
        weak++;
      }

      // At risk if retrievability < 70%
      if (retrievability < 0.7) {
        atRisk++;
      }
    });

    const avgRetrievability = totalRetrievability / lessons.length;
    const avgStability = totalStability / lessons.length;
    
    // Memory Score: weighted combination of mastery progress and retrievability
    const masteryProgress = (mastered + strong * 0.7 + learning * 0.3) / lessons.length;
    const memoryScore = Math.round((masteryProgress * 0.6 + avgRetrievability * 0.4) * 100);

    const categories: LessonCategory[] = [
      { label: 'mastered', count: mastered, color: 'text-success', bgColor: 'bg-success' },
      { label: 'strong', count: strong, color: 'text-primary', bgColor: 'bg-primary' },
      { label: 'learning', count: learning, color: 'text-warning', bgColor: 'bg-warning' },
      { label: 'weak', count: weak, color: 'text-danger', bgColor: 'bg-danger' },
    ];

    return {
      memoryScore,
      categories,
      atRiskCount: atRisk,
      avgRetrievability: Math.round(avgRetrievability * 100),
      avgStability: Math.round(avgStability),
    };
  }, [lessons, masteryThreshold]);

  if (lessons.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">
        {t('masteryChart.noLessons')}
      </div>
    );
  }

  // Circular ring calculations
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (stats.memoryScore / 100) * circumference;

  // Calculate segment widths for progress bar
  const total = lessons.length;
  const getSegmentWidth = (count: number) => `${(count / total) * 100}%`;

  return (
    <div className="flex flex-col gap-4">
      {/* Circular Ring with Memory Score */}
      <div className="flex items-center justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg 
            width={size} 
            height={size} 
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
              className="opacity-30"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--success))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{stats.memoryScore}%</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{t('masteryChart.memory')}</span>
          </div>
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div className="space-y-2">
        <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
          {stats.categories.map((cat, idx) => (
            cat.count > 0 && (
              <div
                key={cat.label}
                className={cn(cat.bgColor, 'transition-all duration-500')}
                style={{ width: getSegmentWidth(cat.count) }}
              />
            )
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {stats.categories.map(cat => (
          <div 
            key={cat.label}
            className="text-center p-2 rounded-lg bg-muted/30"
          >
            <p className={cn('text-lg font-bold', cat.color)}>{cat.count}</p>
            <p className="text-[9px] text-muted-foreground truncate">{t(`masteryChart.${cat.label}`)}</p>
          </div>
        ))}
      </div>

      {/* Additional Stats Row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1">
          <Brain className="w-3 h-3" />
          <span>{t('masteryChart.avgStability', { days: stats.avgStability })}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>{t('masteryChart.recall', { percent: stats.avgRetrievability })}</span>
        </div>
      </div>

      {/* At Risk Alert */}
      {stats.atRiskCount > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-danger/10 border border-danger/20">
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
          <span className="text-xs text-danger font-medium">
            {t('masteryChart.needsReview', { count: stats.atRiskCount })}
          </span>
        </div>
      )}
    </div>
  );
};
