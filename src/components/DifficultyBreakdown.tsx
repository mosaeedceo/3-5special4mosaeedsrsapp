import { useMemo } from 'react';
import { Lesson, Difficulty } from '@/types/lesson';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface DifficultyBreakdownProps {
  lessons: Lesson[];
}

export const DifficultyBreakdown = ({ lessons }: DifficultyBreakdownProps) => {
  const { t } = useTranslation();

  const DIFFICULTY_CONFIG: Record<Difficulty, { color: string; bgClass: string }> = {
    Easy: { 
      color: 'hsl(var(--success))', 
      bgClass: 'bg-success/20 text-success',
    },
    Medium: { 
      color: 'hsl(var(--warning))', 
      bgClass: 'bg-warning/20 text-warning',
    },
    Hard: { 
      color: 'hsl(var(--danger))', 
      bgClass: 'bg-danger/20 text-danger',
    },
  };

  const data = useMemo(() => {
    const counts: Record<Difficulty, { total: number; mastered: number }> = {
      Easy: { total: 0, mastered: 0 },
      Medium: { total: 0, mastered: 0 },
      Hard: { total: 0, mastered: 0 },
    };

    // Explicitly check each lesson's difficulty field
    lessons.forEach(lesson => {
      const diff = lesson.difficulty;
      // Only count if it's a valid difficulty
      if (diff === 'Easy' || diff === 'Medium' || diff === 'Hard') {
        counts[diff].total++;
        if (lesson.completed) {
          counts[diff].mastered++;
        }
      }
    });

    return (['Easy', 'Medium', 'Hard'] as Difficulty[]).map(name => ({
      name,
      total: counts[name].total,
      mastered: counts[name].mastered,
      pending: counts[name].total - counts[name].mastered,
    }));
  }, [lessons]);

  const total = data.reduce((sum, d) => sum + d.total, 0);
  const maxCount = Math.max(...data.map(d => d.total), 1);

  if (total === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-muted-foreground text-sm">
        {t('difficultyBreakdown.noLessons')}
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-sm mx-auto">
      {data.map((item) => {
        const config = DIFFICULTY_CONFIG[item.name as Difficulty];
        const percentage = total > 0 ? Math.round((item.total / total) * 100) : 0;
        const barWidth = maxCount > 0 ? (item.total / maxCount) * 100 : 0;
        
        return (
          <div key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-sm font-medium text-foreground">
                  {t(`difficulties.${item.name}`)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded font-medium',
                  config.bgClass
                )}>
                  {item.total}
                </span>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {percentage}%
                </span>
              </div>
            </div>
            
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${barWidth}%`,
                  backgroundColor: config.color 
                }}
              />
            </div>
            
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{item.mastered} {t('difficultyBreakdown.mastered')}</span>
              <span>{item.pending} {t('difficultyBreakdown.pending')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
