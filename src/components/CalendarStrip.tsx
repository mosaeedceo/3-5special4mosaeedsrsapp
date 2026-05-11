import { useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Lesson } from '@/types/lesson';
import { toLocalDateStr } from '@/lib/date';

interface ActivityRecord {
  date: string;
  count: number;
}

interface CalendarStripProps {
  lessons: Lesson[];
  activityHistory: ActivityRecord[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const toDateStr = toLocalDateStr;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const CalendarStrip = ({
  lessons,
  activityHistory,
  selectedDate,
  onDateSelect,
}: CalendarStripProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);
  const { isRTL } = useTranslation();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build the 38-day window: 7 before today + today + 30 ahead
  const days = useMemo(() => {
    return Array.from({ length: 38 }, (_, i) => addDays(today, i - 7));
  }, [today]);

  // Index of today in the days array
  const todayIndex = 7;

  // Build lookup maps for fast access
  const activityMap = useMemo(() => {
    const map: Record<string, number> = {};
    activityHistory.forEach(r => { map[r.date] = r.count; });
    return map;
  }, [activityHistory]);

  // Future lesson counts by date
  const futureLessonMap = useMemo(() => {
    const map: Record<string, number> = {};
    const todayStr = toDateStr(today);
    lessons.forEach(lesson => {
      if (lesson.completed) return;
      const snoozed = lesson.snoozedUntil && new Date(lesson.snoozedUntil) > today;
      if (snoozed) return;
      const reviewDate = new Date(lesson.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      const dateStr = toDateStr(reviewDate);
      // Only show counts for future dates (strictly after today)
      if (dateStr > todayStr) {
        map[dateStr] = (map[dateStr] || 0) + 1;
      }
    });
    return map;
  }, [lessons, today]);

  // Scroll today cell into view on mount (center it)
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const cell = todayRef.current;
      const containerWidth = container.offsetWidth;
      const cellLeft = cell.offsetLeft;
      const cellWidth = cell.offsetWidth;
      container.scrollLeft = cellLeft - containerWidth / 2 + cellWidth / 2;
    }
  }, []);

  const selectedStr = toDateStr(selectedDate);
  const todayStr = toDateStr(today);

  const DAY_ABBREVS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const DAY_ABBREVS_AR = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];

  return (
    <div className="relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto px-6 pb-1 no-scrollbar scroll-smooth pt-[4px]"
        style={{ scrollBehavior: 'smooth' }}
      >
        {days.map((day, index) => {
          const dateStr = toDateStr(day);
          const isToday = dateStr === todayStr;
          const isPast = day < today;
          const isFuture = day > today;
          const isSelected = dateStr === selectedStr;

          const activityCount = activityMap[dateStr] || 0;
          const futureCount = futureLessonMap[dateStr] || 0;
          const dayAbbrev = (isRTL ? DAY_ABBREVS_AR : DAY_ABBREVS)[day.getDay()];

          return (
            <button
              key={dateStr}
              ref={isToday ? todayRef : undefined}
              onClick={() => onDateSelect(day)}
              className={cn(
                'flex flex-col items-center justify-center min-w-[44px] h-[60px] rounded-xl transition-all duration-200 flex-shrink-0 gap-0.5 relative',
                isToday && !isSelected && 'bg-primary/20 border border-primary/40',
                isSelected && 'bg-primary text-primary-foreground shadow-md scale-105',
                !isToday && !isSelected && 'hover:bg-muted/60',
                isPast && !isSelected && 'opacity-60',
              )}
            >
              <span className={cn(
                'text-[10px] font-medium leading-none',
                isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
              )}>
                {dayAbbrev}
              </span>
              <span className={cn(
                'text-sm font-bold leading-none',
                isSelected ? 'text-primary-foreground' : isToday ? 'text-primary' : 'text-foreground'
              )}>
                {day.getDate()}
              </span>

              {/* Indicator area */}
              <div className="h-3 flex items-center justify-center">
                {isPast && activityCount > 0 && (
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isSelected ? 'bg-primary-foreground/70' : 'bg-success'
                  )} />
                )}
                {isPast && activityCount === 0 && (
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isSelected ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30'
                  )} />
                )}
                {isToday && (
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isSelected ? 'bg-primary-foreground' : 'bg-primary'
                  )} />
                )}
                {isFuture && futureCount > 0 && (
                  <span className={cn(
                    'text-[9px] font-bold leading-none px-1 py-0.5 rounded-full',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary/15 text-primary'
                  )}>
                    {futureCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
