import { useMemo } from 'react';
import { Lesson } from '@/types/lesson';
import { calculateRetrievability } from '@/lib/fsrs';
import { Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MedicalBoardMasteryChartProps {
  lessons: Lesson[];
}

// Convert stability to a percentage score (0-100)
const stabilityToScore = (stability: number): number => {
  if (stability <= 0) return 0;
  if (stability <= 7) return (stability / 7) * 20; // 0-7d = 0-20%
  if (stability <= 21) return 20 + ((stability - 7) / 14) * 20; // 7-21d = 20-40%
  if (stability <= 60) return 40 + ((stability - 21) / 39) * 20; // 21-60d = 40-60%
  if (stability <= 180) return 60 + ((stability - 60) / 120) * 20; // 60-180d = 60-80%
  return Math.min(100, 80 + ((stability - 180) / 365) * 20); // 180d+ = 80-100%
};

export const MedicalBoardMasteryChart = ({ lessons }: MedicalBoardMasteryChartProps) => {
  const stats = useMemo(() => {
    if (lessons.length === 0) {
      return {
        matureCount: 0,
        youngCount: 0,
        atRiskCount: 0,
        avgStability: 0,
        memoryScore: 0,
      };
    }

    const now = new Date();
    let matureCount = 0;
    let youngCount = 0;
    let atRiskCount = 0;
    let totalStability = 0;
    let totalScore = 0;

    lessons.forEach(lesson => {
      const stability = lesson.fsrs?.stability || 0;
      totalStability += stability;
      totalScore += stabilityToScore(stability);

      // Mature = stability >= 21 days
      if (stability >= 21) {
        matureCount++;
      } else {
        youngCount++;
      }

      // Check if at risk (retrievability < 70%)
      if (lesson.fsrs) {
        const lastReview = lesson.fsrs.lastReview 
          ? new Date(lesson.fsrs.lastReview) 
          : new Date(lesson.dateAdded);
        const elapsedDays = Math.max(0, Math.floor(
          (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
        ));
        const retrievability = calculateRetrievability(stability, elapsedDays);
        if (retrievability < 0.7) {
          atRiskCount++;
        }
      }
    });

    return {
      matureCount,
      youngCount,
      atRiskCount,
      avgStability: Math.round(totalStability / lessons.length),
      memoryScore: Math.round(totalScore / lessons.length),
    };
  }, [lessons]);

  if (lessons.length === 0) {
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
  const progressOffset = circumference - (stats.memoryScore / 100) * circumference;

  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 60) return 'hsl(var(--success))';
    if (score >= 40) return 'hsl(var(--primary))';
    if (score >= 20) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

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
            stroke={getScoreColor(stats.memoryScore)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{stats.memoryScore}%</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Memory</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 w-full">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{stats.matureCount}</span> Mature
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{stats.youngCount}</span> Young
          </span>
        </div>
        {stats.atRiskCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{stats.atRiskCount}</span> At Risk
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
