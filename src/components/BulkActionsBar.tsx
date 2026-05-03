import { useState } from 'react';
import { Trash2, X, Merge, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { SnoozeDialog } from './SnoozeDialog';

interface BulkActionsBarProps {
  selectedCount: number;
  onMerge: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  onSnooze?: (until: Date) => void;
  onUnsnooze?: () => void;
  hasSnoozedSelected?: boolean;
}

export const BulkActionsBar = ({
  selectedCount,
  onMerge,
  onDelete,
  onClearSelection,
  onSnooze,
  onUnsnooze,
  hasSnoozedSelected,
}: BulkActionsBarProps) => {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div 
      className="fixed left-1/2 -translate-x-1/2 z-50 animate-slide-up max-w-[calc(100vw-1rem)]"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
    >
      <div className="flex items-center gap-1 sm:gap-2 bg-card border border-border shadow-lg rounded-full px-2 sm:px-4 py-1.5 sm:py-2">
        <span className="text-xs sm:text-sm font-medium text-foreground mr-1 sm:mr-2 whitespace-nowrap">
          {selectedCount} selected
        </span>
        
        {hasSnoozedSelected && onUnsnooze ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary hover:bg-primary/10 h-7 sm:h-8 px-1.5 sm:px-2"
            onClick={onUnsnooze}
            title={t('snooze.unsnooze')}
          >
            <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline ml-1">{t('snooze.unsnooze')}</span>
          </Button>
        ) : (
          onSnooze && (
            <SnoozeDialog
              title={t('bulk.snoozeSelected', { count: selectedCount })}
              type="lesson"
              onSnooze={onSnooze}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary hover:bg-primary/10 h-7 sm:h-8 px-1.5 sm:px-2"
                  title={t('bulk.snooze')}
                >
                  <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline ml-1">{t('bulk.snooze')}</span>
                </Button>
              }
            />
          )
        )}
        
        {selectedCount >= 2 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary hover:bg-primary/10 h-7 sm:h-8 px-1.5 sm:px-2"
            onClick={onMerge}
            title={t('actions.merge')}
          >
            <Merge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline ml-1">{t('actions.merge')}</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:bg-danger/10 h-7 sm:h-8 px-1.5 sm:px-2"
          onClick={onDelete}
          title={t('actions.delete')}
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline ml-1">{t('actions.delete')}</span>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 sm:h-8 sm:w-8 ml-0.5 sm:ml-1"
          onClick={onClearSelection}
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Button>
      </div>
    </div>
  );
};
