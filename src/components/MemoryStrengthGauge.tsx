import { useMemo } from 'react';
import { Lesson, Card as FlashCard, FSRSState } from '@/types/lesson';
import { calculateRetrievability } from '@/lib/fsrs';
import { useTranslation } from '@/hooks/useTranslation';
import { Brain, Shield, AlertTriangle, AlertCircle } from 'lucide-react';

interface StatsItem {
  fsrs?: FSRSState;
  dateAdded: string;
}

interface MemoryStrengthGaugeProps {
  lessons: Lesson[];
  /** Optional cards to merge into memory strength (used when scope includes cards). */
  cards?: FlashCard[];
}

export const MemoryStrengthGauge = ({ lessons, cards }: MemoryStrengthGaugeProps) => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const items: StatsItem[] = [...lessons, ...(cards || [])];
    const itemsWithFSRS = items.filter(l => l.fsrs);
    
    if (itemsWithFSRS.length === 0) {
      return {
        avgRetrievability: 0,
        strongCount: 0,
        atRiskCount: 0,
        needsReviewCount: 0,
        totalWithFSRS: 0,
      };
    }

    let strongCount = 0;
    let atRiskCount = 0;
    let needsReviewCount = 0;
    let totalRetrievability = 0;

    itemsWithFSRS.forEach(item => {
      const lastReview = item.fsrs?.lastReview 
        ? new Date(item.fsrs.lastReview) 
        : new Date(item.dateAdded);
      const elapsedDays = Math.max(0, (Date.now() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
      const retrievability = calculateRetrievability(item.fsrs?.stability || 0, elapsedDays);
      
      totalRetrievability += retrievability;

      if (retrievability >= 0.85) {
        strongCount++;
      } else if (retrievability >= 0.7) {
        atRiskCount++;
      } else {
        needsReviewCount++;
      }
    });

    return {
      avgRetrievability: Math.round((totalRetrievability / itemsWithFSRS.length) * 100),
      strongCount,
      atRiskCount,
      needsReviewCount,
      totalWithFSRS: itemsWithFSRS.length,
    };
  }, [lessons, cards]);

  const getGaugeColor = (percentage: number) => {
    if (percentage >= 85) return 'text-success';
    if (percentage >= 70) return 'text-warning';
    return 'text-danger';
  };

  const getGaugeStrokeColor = (percentage: number) => {
    if (percentage >= 85) return 'hsl(var(--success))';
    if (percentage >= 70) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

  const getStatusText = (percentage: number) => {
    if (percentage >= 85) return t('memoryStrength.excellent');
    if (percentage >= 70) return t('memoryStrength.good');
    if (percentage >= 50) return t('memoryStrength.needsAttention');
    return t('memoryStrength.critical');
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (stats.avgRetrievability / 100) * circumference;

  if (stats.totalWithFSRS === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Brain className="w-12 h-12 mb-2 opacity-30" />
        <p className="text-sm">{t('memoryStrength.noData')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={getGaugeStrokeColor(stats.avgRetrievability)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getGaugeColor(stats.avgRetrievability)}`}>
            {stats.avgRetrievability}%
          </span>
          <span className="text-xs text-muted-foreground">{t('memoryStrength.recall')}</span>
        </div>
      </div>

      <p className={`mt-2 text-sm font-medium ${getGaugeColor(stats.avgRetrievability)}`}>
        {getStatusText(stats.avgRetrievability)}
      </p>

      <div className="grid grid-cols-3 gap-3 mt-4 w-full">
        <div className="flex flex-col items-center p-2 rounded-lg bg-success/10">
          <Shield className="w-4 h-4 text-success mb-1" />
          <span className="text-lg font-bold text-success">{stats.strongCount}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">
            {t('memoryStrength.strong')}
          </span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-warning/10">
          <AlertTriangle className="w-4 h-4 text-warning mb-1" />
          <span className="text-lg font-bold text-warning">{stats.atRiskCount}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">
            {t('memoryStrength.atRisk')}
          </span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-danger/10">
          <AlertCircle className="w-4 h-4 text-danger mb-1" />
          <span className="text-lg font-bold text-danger">{stats.needsReviewCount}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">
            {t('memoryStrength.needsReview')}
          </span>
        </div>
      </div>
    </div>
  );
};
