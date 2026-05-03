import { Smartphone, Tablet, MonitorSmartphone } from 'lucide-react';
import { DisplayMode } from '@/types/lesson';
import { cn } from '@/lib/utils';

interface DisplayModeSelectorProps {
  value: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

const displayOptions = [
  { value: 'mobile' as DisplayMode, icon: Smartphone, label: 'Mobile' },
  { value: 'tablet' as DisplayMode, icon: Tablet, label: 'Tablet' },
  { value: 'auto' as DisplayMode, icon: MonitorSmartphone, label: 'Auto' },
];

export const DisplayModeSelector = ({ value, onChange }: DisplayModeSelectorProps) => {
  return (
    <div className="grid grid-cols-3 gap-3">
      {displayOptions.map(({ value: optionValue, icon: Icon, label }) => (
        <button
          key={optionValue}
          onClick={() => onChange(optionValue)}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200',
            value === optionValue
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50'
          )}
        >
          <Icon
            className={cn(
              'w-5 h-5',
              value === optionValue ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <span
            className={cn(
              'text-sm font-medium',
              value === optionValue ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
};
