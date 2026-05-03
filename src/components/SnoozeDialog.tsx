import { useState } from 'react';
import { Moon, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toLocalDateStr } from '@/lib/date';

interface SnoozeDialogProps {
  title: string;
  type: 'lesson' | 'category';
  onSnooze: (until: Date) => void;
  trigger?: React.ReactNode;
}

export const SnoozeDialog = ({ title, type, onSnooze, trigger }: SnoozeDialogProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState('');

  const presets = [
    { days: 1, label: t('snooze.oneDay') },
    { days: 3, label: t('snooze.threeDays') },
    { days: 7, label: t('snooze.oneWeek') },
    { days: 30, label: t('snooze.oneMonth') },
  ];

  const handleSnooze = (days: number) => {
    const until = new Date();
    until.setDate(until.getDate() + days);
    until.setHours(0, 0, 0, 0);
    onSnooze(until);
    setOpen(false);
  };

  const handleCustomSnooze = () => {
    if (customDate) {
      const until = new Date(customDate);
      until.setHours(0, 0, 0, 0);
      onSnooze(until);
      setOpen(false);
      setCustomDate('');
    }
  };

  // Set minimum date to tomorrow (local)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = toLocalDateStr(tomorrow);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Moon className="w-4 h-4" />
            {t('snooze.button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)]" onSwipeClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Moon className="w-5 h-5 text-primary" />
            {t('snooze.title')}
          </DialogTitle>
          <DialogDescription>
            {type === 'lesson' 
              ? t('snooze.lessonDesc', { title }) 
              : t('snooze.categoryDesc', { title })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Preset buttons */}
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.days}
                variant="outline"
                className="flex items-center gap-2 h-11"
                onClick={() => handleSnooze(preset.days)}
              >
                <Clock className="w-4 h-4" />
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {t('snooze.customDate')}
            </label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={minDate}
                className="flex-1"
              />
              <Button 
                onClick={handleCustomSnooze}
                disabled={!customDate}
              >
                {t('snooze.set')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
