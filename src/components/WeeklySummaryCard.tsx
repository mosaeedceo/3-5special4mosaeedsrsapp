import { useMemo } from 'react';
import { ActivityRecord } from '@/types/lesson';
import { useTranslation } from '@/hooks/useTranslation';
import { TrendingUp, TrendingDown, Minus, Calendar, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDateStr } from '@/lib/date';

interface WeeklySummaryCardProps {
  activityHistory: ActivityRecord[];
}

export const WeeklySummaryCard = ({ activityHistory }: WeeklySummaryCardProps) => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(today);
    const currentDay = thisWeekStart.getDay();
    const daysFromSaturday = currentDay >= 6 ? currentDay - 6 : currentDay + 1;
    thisWeekStart.setDate(thisWeekStart.getDate() - daysFromSaturday);
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59, 999);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

    const daysElapsedThisWeek = daysFromSaturday + 1;

    let thisWeekTotal = 0;
    let thisWeekDaysActive = 0;
    let lastWeekTotal = 0;
    let lastWeekDaysActive = 0;
    let thisWeekBestDay = 0;
    let lastWeekBestDay = 0;

    activityHistory.forEach(record => {
      const recordDate = parseLocalDateStr(record.date);
      recordDate.setHours(0, 0, 0, 0);

      if (recordDate >= thisWeekStart && recordDate <= today) {
        thisWeekTotal += record.count;
        if (record.count > 0) thisWeekDaysActive++;
        thisWeekBestDay = Math.max(thisWeekBestDay, record.count);
      } else if (recordDate >= lastWeekStart && recordDate <= lastWeekEnd) {
        lastWeekTotal += record.count;
        if (record.count > 0) lastWeekDaysActive++;
        lastWeekBestDay = Math.max(lastWeekBestDay, record.count);
      }
    });

    const totalChange = lastWeekTotal > 0 
      ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
      : thisWeekTotal > 0 ? 100 : 0;

    const avgThisWeek = Math.round(thisWeekTotal / daysElapsedThisWeek);
    const avgLastWeek = Math.round(lastWeekTotal / 7);

    return {
      thisWeekTotal,
      lastWeekTotal,
      thisWeekDaysActive,
      lastWeekDaysActive,
      thisWeekBestDay,
      lastWeekBestDay,
      totalChange,
      avgThisWeek,
      avgLastWeek,
      isImproved: thisWeekTotal > lastWeekTotal,
      isDeclined: thisWeekTotal < lastWeekTotal,
      isSame: thisWeekTotal === lastWeekTotal,
    };
  }, [activityHistory]);

  const getTrendIcon = () => {
    if (stats.isImproved) return <TrendingUp className="w-5 h-5 text-success" />;
    if (stats.isDeclined) return <TrendingDown className="w-5 h-5 text-danger" />;
    return <Minus className="w-5 h-5 text-muted-foreground" />;
  };

  const getTrendText = () => {
    if (stats.isImproved) return t('weeklySummary.improved');
    if (stats.isDeclined) return t('weeklySummary.declined');
    return t('weeklySummary.same');
  };

  const getTrendColor = () => {
    if (stats.isImproved) return 'text-success';
    if (stats.isDeclined) return 'text-danger';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
        <div className="flex items-center gap-3">
          {getTrendIcon()}
          <div>
            <p className={cn("text-sm font-medium", getTrendColor())}>
              {getTrendText()}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('weeklySummary.vsLastWeek')}
            </p>
          </div>
        </div>
        {stats.totalChange !== 0 && (
          <span className={cn(
            "text-lg font-bold",
            stats.isImproved ? 'text-success' : 'text-danger'
          )}>
            {stats.isImproved ? '+' : ''}{stats.totalChange}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">{t('weeklySummary.thisWeek')}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.thisWeekTotal}</p>
          <p className="text-xs text-muted-foreground">
            {stats.thisWeekDaysActive} {t('weeklySummary.daysActive')}
          </p>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t('weeklySummary.lastWeek')}</span>
          </div>
          <p className="text-2xl font-bold text-muted-foreground">{stats.lastWeekTotal}</p>
          <p className="text-xs text-muted-foreground">
            {stats.lastWeekDaysActive} {t('weeklySummary.daysActive')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
          <Zap className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{stats.thisWeekBestDay}</p>
            <p className="text-[10px] text-muted-foreground">{t('weeklySummary.bestDay')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
          <Target className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{stats.avgThisWeek}/day</p>
            <p className="text-[10px] text-muted-foreground">{t('weeklySummary.dailyAvg')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
