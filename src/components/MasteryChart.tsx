import { cn } from '@/lib/utils';
import { CheckCircle2, Clock } from 'lucide-react';

interface MasteryChartProps {
  completed: number;
  inProgress: number;
  masteryPercentage: number;
}

export const MasteryChart = ({ completed, inProgress, masteryPercentage }: MasteryChartProps) => {
  const total = completed + inProgress;
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">
        No lessons added yet
      </div>
    );
  }

  // Calculate the circumference and stroke offset for the circular progress
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (masteryPercentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Circular Progress Ring */}
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
          <span className="text-3xl font-bold text-foreground">{masteryPercentage}%</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Mastery</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 w-full">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{completed}</span> Mastered
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{inProgress}</span> In Progress
          </span>
        </div>
      </div>
    </div>
  );
};
