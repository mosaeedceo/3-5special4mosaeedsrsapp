import { useState } from 'react';
import { Plus, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface IntervalBuilderProps {
  intervals: number[];
  onChange: (intervals: number[]) => void;
  compact?: boolean;
}

export const IntervalBuilder = ({ intervals, onChange, compact = false }: IntervalBuilderProps) => {
  const [newInterval, setNewInterval] = useState('');
  const { t, isRTL } = useTranslation();

  const IconArrow = ArrowRight;

  const handleAddInterval = () => {
    const value = parseInt(newInterval, 10);
    if (value > 0 && !isNaN(value)) {
      onChange([...intervals, value].sort((a, b) => a - b));
      setNewInterval('');
    }
  };

  const handleRemoveInterval = (index: number) => {
    if (intervals.length <= 1) return;
    onChange(intervals.filter((_, i) => i !== index));
  };

  const handleUpdateInterval = (index: number, value: string) => {
    const numValue = parseInt(value, 10);
    if (numValue > 0 && !isNaN(numValue)) {
      const newIntervals = [...intervals];
      newIntervals[index] = numValue;
      onChange(newIntervals.sort((a, b) => a - b));
    }
  };

  // Calculate cumulative days
  const cumulativeDays = intervals.reduce((acc: number[], curr, idx) => {
    const prev = idx > 0 ? acc[idx - 1] : 0;
    acc.push(prev + curr);
    return acc;
  }, []);

  const totalDays = cumulativeDays[cumulativeDays.length - 1] || 0;

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Compact Visual Timeline */}
        <div className={cn("flex flex-wrap items-center gap-1.5", isRTL && "flex-row-reverse")}>
          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
            {t('intervalBuilder.start')}
          </span>
          {intervals.map((interval, index) => (
            <div key={index} className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <IconArrow className={cn("w-3 h-3 text-muted-foreground")} />
              <div className="relative group">
                <Input
                  type="number"
                  value={interval}
                  onChange={(e) => handleUpdateInterval(index, e.target.value)}
                  className="w-10 h-6 text-center text-xs px-1"
                  min="1"
                  dir="ltr"
                />
                {intervals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveInterval(index)}
                    className={cn(
                      "absolute -top-1.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                      isRTL ? "-left-1.5" : "-right-1.5"
                    )}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <IconArrow className={cn("w-3 h-3 text-muted-foreground")} />
          <span className="px-1.5 py-0.5 rounded bg-success/20 text-success text-[10px] font-medium">
            {t('intervalBuilder.done')}
          </span>
        </div>

        {/* Compact Add New */}
        <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
          <Input
            type="number"
            value={newInterval}
            onChange={(e) => setNewInterval(e.target.value)}
            placeholder={t('intervalBuilder.days')}
            className="w-16 h-7 text-xs"
            min="1"
            dir="ltr"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddInterval();
              }
            }}
          />
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            className="h-7 text-xs px-2"
            onClick={handleAddInterval}
            disabled={!newInterval || parseInt(newInterval) <= 0}
          >
            <Plus className={cn("w-3 h-3", isRTL ? "ml-1" : "mr-1")} />
            {t('intervalBuilder.add')}
          </Button>
        </div>

        {/* Compact Preview */}
        <div className="p-2 rounded-lg bg-muted/50">
          <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right")}>
            {t('intervalBuilder.reviewsToMastery', { reviews: intervals.length, days: totalDays })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual Timeline */}
      <div className={cn("flex flex-wrap items-center gap-2", isRTL && "flex-row-reverse")}>
        <div className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
          {t('intervalBuilder.start')}
        </div>
        {intervals.map((interval, index) => (
          <div key={index} className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <IconArrow className={cn("w-4 h-4 text-muted-foreground")} />
            <div className="relative group">
              <Input
                type="number"
                value={interval}
                onChange={(e) => handleUpdateInterval(index, e.target.value)}
                className="w-16 h-8 text-center text-sm px-2"
                min="1"
                dir="ltr"
              />
              {intervals.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveInterval(index)}
                  className={cn(
                    "absolute -top-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                    isRTL ? "-left-2" : "-right-2"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                {t('intervalBuilder.day')} {cumulativeDays[index]}
              </span>
            </div>
          </div>
        ))}
        <IconArrow className={cn("w-4 h-4 text-muted-foreground")} />
        <div className="px-2 py-1 rounded bg-success/20 text-success text-xs font-medium">
          {t('intervalBuilder.mastered')}
        </div>
      </div>

      {/* Add New Interval */}
      <div className={cn("flex gap-2 pt-4", isRTL && "flex-row-reverse")}>
        <Input
          type="number"
          value={newInterval}
          onChange={(e) => setNewInterval(e.target.value)}
          placeholder={t('intervalBuilder.days')}
          className="w-20"
          min="1"
          dir="ltr"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddInterval();
            }
          }}
        />
        <Button 
          type="button"
          variant="outline" 
          size="sm"
          onClick={handleAddInterval}
          disabled={!newInterval || parseInt(newInterval) <= 0}
        >
          <Plus className={cn("w-4 h-4", isRTL ? "ml-1" : "mr-1")} />
          {t('intervalBuilder.addStage')}
        </Button>
      </div>

      {/* Preview Timeline */}
      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
        <p className={cn("text-xs font-medium text-foreground", isRTL && "text-right")}>{t('intervalBuilder.preview')}</p>
        <div className={cn("text-[10px] sm:text-xs text-muted-foreground", isRTL && "text-right")}>
          {intervals.map((interval, idx) => (
            <span key={idx}>
              {t('intervalBuilder.review')} {idx + 1} ({t('intervalBuilder.day')} {cumulativeDays[idx]})
              {idx < intervals.length - 1 && ' → '}
            </span>
          ))}
          <span className="text-success font-medium"> → {t('intervalBuilder.mastered')}!</span>
        </div>
        <p className={cn("text-xs text-primary font-medium", isRTL && "text-right")}>
          {t('intervalBuilder.totalDays', { days: totalDays, reviews: intervals.length })}
        </p>
      </div>
    </div>
  );
};
