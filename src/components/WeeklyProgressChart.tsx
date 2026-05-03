import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ActivityRecord } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { toLocalDateStr } from '@/lib/date';

interface WeeklyProgressChartProps {
  activityHistory: ActivityRecord[];
}

export const WeeklyProgressChart = ({ activityHistory }: WeeklyProgressChartProps) => {
  const [viewDays, setViewDays] = useState<7 | 30>(7);
  const { t, isRTL } = useTranslation();

  const chartData = useMemo(() => {
    const today = new Date();
    const data = [];

    const enDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const arDayNames = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
    const dayNames = isRTL ? arDayNames : enDayNames;

    if (viewDays === 7) {
      const startOfWeek = new Date(today);
      const currentDay = startOfWeek.getDay();
      const daysFromSaturday = currentDay >= 6 ? currentDay - 6 : currentDay + 1;
      startOfWeek.setDate(startOfWeek.getDate() - daysFromSaturday);

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        const dateStr = toLocalDateStr(date);
        const todayStr = toLocalDateStr(today);
        const record = activityHistory.find(r => r.date === dateStr);
        const isFuture = dateStr > todayStr;

        data.push({
          day: dayNames[date.getDay()],
          fullDate: date.toLocaleDateString(isRTL ? 'ar' : 'en', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }),
          count: isFuture ? 0 : (record?.count || 0),
          isToday: dateStr === todayStr,
        });
      }
    } else {
      for (let i = viewDays - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = toLocalDateStr(date);
        const record = activityHistory.find(r => r.date === dateStr);

        data.push({
          day: `${date.getMonth() + 1}/${date.getDate()}`,
          fullDate: date.toLocaleDateString(isRTL ? 'ar' : 'en', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }),
          count: record?.count || 0,
          isToday: i === 0,
        });
      }
    }

    return data;
  }, [activityHistory, viewDays, isRTL]);

  const totalReviews = chartData.reduce((sum, d) => sum + d.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2">
          <p className="text-xs text-muted-foreground">{data.fullDate}</p>
          <p className="text-sm font-semibold text-foreground">
            {data.count} {data.count === 1 ? t('stats.review') : t('stats.reviews')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="flex justify-end mb-3 gap-1">
        <Button
          size="sm"
          variant={viewDays === 7 ? 'default' : 'outline'}
          onClick={() => setViewDays(7)}
          className="h-7 px-3 text-xs"
        >
          7 {t('stats.days')}
        </Button>
        <Button
          size="sm"
          variant={viewDays === 30 ? 'default' : 'outline'}
          onClick={() => setViewDays(30)}
          className="h-7 px-3 text-xs"
        >
          30 {t('stats.days')}
        </Button>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="day" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              interval={viewDays === 30 ? 4 : 0}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              allowDecimals={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorGradient)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.count === 0) return null;
                return (
                  <circle
                    key={`dot-${props.index}`}
                    cx={cx}
                    cy={cy}
                    r={payload.isToday ? 5 : 3}
                    fill={payload.isToday ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.7)'}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{
                r: 6,
                fill: 'hsl(var(--primary))',
                stroke: 'hsl(var(--background))',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>{viewDays === 7 ? t('weeklySummary.thisWeek') : t('stats.last30Days')}</span>
        <span className="font-medium text-foreground">
          {totalReviews} {totalReviews === 1 ? t('stats.review') : t('stats.reviews')}
        </span>
      </div>
    </div>
  );
};
