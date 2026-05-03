import { useMemo } from 'react';
import { Lesson } from '@/types/lesson';

interface StageDistributionChartProps {
  lessons: Lesson[];
  intervals: number[];
}

export const StageDistributionChart = ({ lessons, intervals }: StageDistributionChartProps) => {
  const stageData = useMemo(() => {
    const stages = intervals.map((interval, index) => ({
      name: index === 0 ? 'New' : index === intervals.length - 1 ? 'Almost Done' : `Stage ${index + 1}`,
      interval: `${interval}d`,
      count: 0,
    }));

    // Add completed stage
    stages.push({ name: 'Mastered', interval: '∞', count: 0 });

    lessons.forEach(lesson => {
      if (lesson.completed) {
        stages[stages.length - 1].count++;
      } else if (lesson.currentStage < stages.length - 1) {
        stages[lesson.currentStage].count++;
      }
    });

    return stages;
  }, [lessons, intervals]);

  const maxCount = Math.max(...stageData.map(s => s.count), 1);

  return (
    <div className="space-y-3">
      {stageData.map((stage, index) => (
        <div key={stage.name} className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-foreground font-medium">{stage.name}</span>
            <span className="text-muted-foreground">
              {stage.count} <span className="text-xs">({stage.interval})</span>
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${(stage.count / maxCount) * 100}%`,
                backgroundColor: index === stageData.length - 1 
                  ? 'hsl(var(--success))' 
                  : `hsl(var(--primary) / ${0.4 + (index / stageData.length) * 0.6})`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
