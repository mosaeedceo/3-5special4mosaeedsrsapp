import { cn } from '@/lib/utils';
import { formatInterval } from '@/lib/fsrs';
import { useTranslation } from '@/hooks/useTranslation';

interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
  // FSRS Mode props
  useFSRS?: boolean;
  medicalBoardMode?: boolean;
  stability?: number; // FSRS stability in days
  masteryThreshold?: number; // Days for mastery (default 21)
}

export const ProgressBar = ({ 
  current, 
  total, 
  className,
  useFSRS = false,
  medicalBoardMode = false,
  stability,
  masteryThreshold = 21,
}: ProgressBarProps) => {
  const { t, isRTL } = useTranslation();

  // FSRS Mode (Medical Board or regular FSRS): Show stability-based progress
  if ((useFSRS || medicalBoardMode) && stability !== undefined) {
    // For Medical Board: use 365 days as max (endless mode)
    // For regular FSRS: use mastery threshold as target
    const maxStability = medicalBoardMode ? 365 : masteryThreshold;
    const percentage = Math.min((stability / maxStability) * 100, 100);
    const stabilityLabel = formatInterval(Math.round(stability));
    const isMastered = !medicalBoardMode && stability >= masteryThreshold;
    
    return (
      <div className={cn('w-full', className)}>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{t('progress.memoryStrength')}</span>
          <span className={cn(isMastered && 'text-success font-medium')}>
            {isMastered ? `✓ ${t('progress.mastered')}` : stabilityLabel}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden relative">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out absolute top-0",
              isRTL ? "right-0" : "left-0",
              isMastered ? "bg-success" : "gradient-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  // Legacy stage-based progress (FSRS disabled)
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{t('progress.stage')}</span>
        <span dir="ltr">{current}/{total} {t('progress.stages')}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
        <div
          className={cn(
            "h-full gradient-primary rounded-full transition-all duration-500 ease-out absolute top-0",
            isRTL ? "right-0" : "left-0"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
