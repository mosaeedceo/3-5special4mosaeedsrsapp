import { useMemo } from 'react';
import { Lesson } from '@/types/lesson';
import { calculateRetrievability } from '@/lib/fsrs';
import { useTranslation } from '@/hooks/useTranslation';

interface StabilityDistributionChartProps {
  lessons: Lesson[];
}

export const StabilityDistributionChart = ({ lessons }: StabilityDistributionChartProps) => {
  const { t, isRTL } = useTranslation();
  
  const STABILITY_RANGES = useMemo(() => [
    { label: t('stabilityChart.new'), range: '0-7d', min: 0, max: 7, color: 'hsl(var(--danger))' },
    { label: t('stabilityChart.learning'), range: '7-21d', min: 7, max: 21, color: 'hsl(var(--warning))' },
    { label: t('stabilityChart.maturing'), range: '21-60d', min: 21, max: 60, color: 'hsl(var(--primary))' },
    { label: t('stabilityChart.strong'), range: '60-180d', min: 60, max: 180, color: 'hsl(var(--success) / 0.8)' },
    { label: t('stabilityChart.mastered'), range: '180d+', min: 180, max: Infinity, color: 'hsl(var(--success))' },
  ], [t]);

  const distributionData = useMemo(() => {
    const distribution = STABILITY_RANGES.map(range => ({
      ...range,
      count: 0,
    }));

    lessons.forEach(lesson => {
      const stability = lesson.fsrs?.stability || 0;
      
      for (let i = 0; i < distribution.length; i++) {
        if (stability >= distribution[i].min && stability < distribution[i].max) {
          distribution[i].count++;
          break;
        }
      }
    });

    return distribution;
  }, [lessons]);

  const maxCount = Math.max(...distributionData.map(d => d.count), 1);

  // Calculate average stability
  const avgStability = useMemo(() => {
    if (lessons.length === 0) return 0;
    const total = lessons.reduce((sum, l) => sum + (l.fsrs?.stability || 0), 0);
    return Math.round(total / lessons.length);
  }, [lessons]);

  // Calculate average retrievability
  const avgRetrievability = useMemo(() => {
    if (lessons.length === 0) return 0;
    const now = new Date();
    
    const totalRetrievability = lessons.reduce((sum, lesson) => {
      if (!lesson.fsrs) return sum;
      
      const lastReview = lesson.fsrs.lastReview 
        ? new Date(lesson.fsrs.lastReview) 
        : new Date(lesson.dateAdded);
      const elapsedDays = Math.max(0, Math.floor(
        (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
      ));
      
      return sum + calculateRetrievability(lesson.fsrs.stability, elapsedDays);
    }, 0);
    
    return Math.round((totalRetrievability / lessons.length) * 100);
  }, [lessons]);

  if (lessons.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">
        {t('statsPage.noLessons')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex justify-around text-center border-b border-border pb-3">
        <div>
          <p className="text-lg font-bold text-foreground">{avgStability}d</p>
          <p className="text-[10px] text-muted-foreground uppercase">{t('progress.stability')}</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{avgRetrievability}%</p>
          <p className="text-[10px] text-muted-foreground uppercase">{t('statsPage.recall')}</p>
        </div>
      </div>

      {/* Distribution Bars */}
      <div className="space-y-3">
        {distributionData.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-foreground font-medium">{item.label}</span>
              <span className="text-muted-foreground">
                {item.count} <span className="text-xs">({item.range})</span>
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
