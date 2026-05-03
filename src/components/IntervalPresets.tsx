import { Zap, Clock, Leaf, Wrench } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface IntervalPresetsProps {
  currentIntervals: number[];
  onSelectPreset: (intervals: number[]) => void;
  compact?: boolean;
  customIntervals?: number[];
}

const BASE_PRESETS = [
  {
    id: 'standard',
    icon: Clock,
    intervals: [1, 1, 4, 7, 14, 30],
  },
  {
    id: 'aggressive',
    icon: Zap,
    intervals: [1, 2, 4, 7, 14],
  },
  {
    id: 'relaxed',
    icon: Leaf,
    intervals: [1, 3, 7, 14, 30, 60],
  },
];

export const IntervalPresets = ({ 
  currentIntervals, 
  onSelectPreset, 
  compact = false,
  customIntervals 
}: IntervalPresetsProps) => {
  const { t } = useTranslation();
  
  // Check if current intervals match any base preset
  const matchesBasePreset = BASE_PRESETS.some(
    preset => JSON.stringify(preset.intervals) === JSON.stringify(currentIntervals)
  );
  
  // Build presets list with Custom option
  const presets = [
    ...BASE_PRESETS.map(preset => ({
      ...preset,
      name: t(`intervalPresets.${preset.id}`),
      description: t(`intervalPresets.${preset.id}Desc`),
    })),
    {
      id: 'custom',
      name: t('intervalPresets.custom'),
      icon: Wrench,
      intervals: customIntervals || currentIntervals,
      description: t('intervalPresets.customDesc'),
    },
  ];

  const isPresetActive = (presetId: string, presetIntervals: number[]) => {
    if (presetId === 'custom') {
      // Custom is active if current intervals don't match any base preset
      return !matchesBasePreset;
    }
    return JSON.stringify(currentIntervals) === JSON.stringify(presetIntervals);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {presets.map((preset) => {
        const Icon = preset.icon;
        const isActive = isPresetActive(preset.id, preset.intervals);
        
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset.intervals)}
            className={`${compact ? 'p-2' : 'p-3'} rounded-lg border text-left transition-all duration-200 ${
              isActive
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${isActive ? 'text-primary' : 'text-foreground'}`}>
                {preset.name}
              </span>
            </div>
            {!compact && (
              <p className="text-xs text-muted-foreground mb-2">
                {preset.description}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {preset.intervals.map((interval, idx) => (
                <span 
                  key={idx}
                  className={`${compact ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5'} rounded ${
                    isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {interval}d
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};
