import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, GraduationCap, Infinity, Clock, ChevronDown, Moon, AlarmClock, Palette, X } from 'lucide-react';
import { IntervalPresets } from './IntervalPresets';
import { IntervalBuilder } from './IntervalBuilder';
import { SnoozeDialog } from './SnoozeDialog';
import { DEFAULT_INTERVALS } from '@/types/lesson';
import { useTranslation } from '@/hooks/useTranslation';

const PRESET_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
];

interface CategoryActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  lessonCount: number;
  isMedicalBoardMode: boolean;
  isLegacyMode: boolean;
  legacyIntervals?: number[];
  snoozedUntil?: string | null;
  categoryColor?: string;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (categoryName: string, deleteAllLessons: boolean) => void;
  onToggleMedicalBoardMode: (categoryName: string, enabled: boolean) => void;
  onToggleLegacyMode: (categoryName: string, enabled: boolean, intervals?: number[]) => void;
  onUpdateLegacyIntervals: (categoryName: string, intervals: number[]) => void;
  onUpdateColor?: (categoryName: string, color: string | undefined) => void;
  onSnooze?: (categoryName: string, until: Date) => void;
  onUnsnooze?: (categoryName: string) => void;
}

export const CategoryActionsDialog = ({
  open,
  onOpenChange,
  categoryName,
  lessonCount,
  isMedicalBoardMode,
  isLegacyMode,
  legacyIntervals,
  snoozedUntil,
  categoryColor,
  onRename,
  onDelete,
  onToggleMedicalBoardMode,
  onToggleLegacyMode,
  onUpdateLegacyIntervals,
  onUpdateColor,
  onSnooze,
  onUnsnooze,
}: CategoryActionsDialogProps) => {
  const { t, formatDate } = useTranslation();
  const [newName, setNewName] = useState(categoryName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOption, setDeleteOption] = useState<'move' | 'delete'>('move');
  const [currentIntervals, setCurrentIntervals] = useState<number[]>(legacyIntervals || DEFAULT_INTERVALS);

  // Sync state when dialog opens
  useEffect(() => {
    setNewName(categoryName);
    setCurrentIntervals(legacyIntervals || DEFAULT_INTERVALS);
  }, [categoryName, legacyIntervals, open]);

  const handleRename = () => {
    if (!newName.trim()) {
      return;
    }
    if (newName.trim() === categoryName) {
      onOpenChange(false);
      return;
    }
    onRename(categoryName, newName.trim());
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDelete(categoryName, deleteOption === 'delete');
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const handleLegacyModeToggle = (enabled: boolean) => {
    onToggleLegacyMode(categoryName, enabled, enabled ? currentIntervals : undefined);
  };

  const handleIntervalsChange = (intervals: number[]) => {
    setCurrentIntervals(intervals);
    if (isLegacyMode) {
      onUpdateLegacyIntervals(categoryName, intervals);
    }
  };

  const handleSnooze = (until: Date) => {
    onSnooze?.(categoryName, until);
  };

  const handleUnsnooze = () => {
    onUnsnooze?.(categoryName);
  };

  // Format snoozed date for display
  const formattedSnoozeDate = snoozedUntil 
    ? formatDate(new Date(snoozedUntil), { month: 'short', day: 'numeric' })
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto" onSwipeClose={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle className="font-heading">{t('categoryActions.editCategory')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6 pt-2 sm:pt-4">
            {/* Snooze Section */}
            {onSnooze && (
              <div className={`p-3 sm:p-4 rounded-lg border space-y-2 sm:space-y-3 ${snoozedUntil ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30'}`}>
                <div className="flex items-center gap-2">
                  <Moon className={`w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 ${snoozedUntil ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-xs sm:text-sm">{t('snooze.title')}</span>
                </div>
                
                {snoozedUntil ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <AlarmClock className="w-3 h-3" />
                        {t('categoryActions.categorySnoozedUntil', { date: formattedSnoozeDate })}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnsnooze}
                      className="w-full"
                    >
                      {t('snooze.unsnooze')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] sm:text-xs text-muted-foreground pr-2">
                      {t('snooze.categoryDesc', { title: categoryName })}
                    </p>
                    <SnoozeDialog
                      title={categoryName}
                      type="category"
                      onSnooze={handleSnooze}
                      trigger={
                        <Button variant="outline" size="sm" className="flex-shrink-0">
                          {t('categoryActions.snoozeCategory')}
                        </Button>
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Category Color Picker */}
            {onUpdateColor && (
              <div className="p-3 sm:p-4 rounded-lg border border-border bg-muted/30 space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 sm:w-5 h-4 sm:h-5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-xs sm:text-sm">{t('categoryActions.cardColor') || 'Card Color'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => onUpdateColor(categoryName, color.value)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-all ${
                        categoryColor === color.value
                          ? 'border-foreground scale-110 ring-2 ring-foreground/20'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                      aria-label={`${color.name} color${categoryColor === color.value ? ' (selected)' : ''}`}
                      data-testid={`color-${color.name.toLowerCase()}`}
                    />
                  ))}
                  {categoryColor && (
                    <button
                      type="button"
                      onClick={() => onUpdateColor(categoryName, undefined)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-foreground transition-colors"
                      title={t('actions.clear') || 'Clear'}
                      aria-label={t('actions.clear') || 'Clear color selection'}
                      data-testid="color-clear"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Medical Board Mode Toggle */}
            <div className="p-3 sm:p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 sm:w-5 h-4 sm:h-5 text-primary flex-shrink-0" />
                <div className="flex items-center gap-1">
                  <span className="font-medium text-xs sm:text-sm">{t('settings.medicalBoardMode')}</span>
                  <Infinity className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground pr-2">
                  {t('categoryActions.endlessFSRS')}
                </p>
                <Switch
                  checked={isMedicalBoardMode}
                  onCheckedChange={(checked) => onToggleMedicalBoardMode(categoryName, checked)}
                  disabled={isLegacyMode}
                  className="flex-shrink-0"
                />
              </div>
              {isMedicalBoardMode && (
                <p className="text-[10px] sm:text-xs text-primary">
                  ✨ {t('categoryActions.lessonsNeverComplete')}
                </p>
              )}
            </div>

            {/* Legacy Mode Toggle */}
            <div className={`p-3 sm:p-4 rounded-lg border space-y-2 sm:space-y-3 ${isLegacyMode ? 'border-warning/50 bg-warning/5' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 ${isLegacyMode ? 'text-warning' : 'text-muted-foreground'}`} />
                <span className="font-medium text-xs sm:text-sm">{t('legacy.title')}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground pr-2">
                  {t('categoryActions.useClassicScheduling')}
                </p>
                <Switch
                  checked={isLegacyMode}
                  onCheckedChange={handleLegacyModeToggle}
                  disabled={isMedicalBoardMode}
                  className="flex-shrink-0"
                />
              </div>
              
              {isLegacyMode && (
                <div className="pt-2 sm:pt-3 space-y-2 sm:space-y-3 border-t border-warning/20">
                  <p className="text-[10px] sm:text-xs font-medium text-warning">
                    📅 {t('categoryActions.setIntervalsForCategory')}
                  </p>
                  <IntervalPresets
                    currentIntervals={currentIntervals}
                    onSelectPreset={handleIntervalsChange}
                    compact
                  />
                  
                  {/* Custom Interval Builder */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ChevronDown className="w-3 h-3" />
                      {t('categoryActions.customizeIntervals')}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <IntervalBuilder
                        intervals={currentIntervals}
                        onChange={handleIntervalsChange}
                        compact
                      />
                    </CollapsibleContent>
                  </Collapsible>
                  
                  <p className="text-[10px] text-muted-foreground">
                    {t('categoryActions.current')} {currentIntervals.join(', ')} {t('categoryActions.days')}
                  </p>
                </div>
              )}
            </div>

            {/* Rename Section */}
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="category-name" className="text-xs sm:text-sm">{t('categoryActions.categoryName')}</Label>
              <div className="flex gap-2">
                <Input
                  id="category-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('categoryActions.categoryNamePlaceholder')}
                  className="text-sm"
                />
                <Button onClick={handleRename} size="icon" className="flex-shrink-0 min-h-[44px] min-w-[44px]">
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Delete Section */}
            <div className="pt-3 sm:pt-4 border-t border-border">
              <Button
                variant="destructive"
                className="w-full min-h-[44px]"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('categoryActions.deleteCategory')}
              </Button>
              {lessonCount > 0 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">
                  {t('categoryActions.hasLessons', { count: lessonCount })}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.delete')} "{categoryName}"?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {lessonCount > 0 ? (
                  <div className="space-y-4">
                    <p>{t('categoryActions.hasLessons', { count: lessonCount })} {t('categoryActions.whatToDo')}</p>
                    
                    <RadioGroup value={deleteOption} onValueChange={(v) => setDeleteOption(v as 'move' | 'delete')}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="move" id="move" />
                        <Label htmlFor="move" className="font-normal cursor-pointer text-sm">
                          {t('categoryActions.moveToUncategorized')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="delete" id="delete-all" />
                        <Label htmlFor="delete-all" className="font-normal cursor-pointer text-danger text-sm">
                          {t('categoryActions.deleteAll')}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ) : (
                  <p>{t('categoryActions.cannotBeUndone')}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="min-h-[44px]">{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger hover:bg-danger/90 min-h-[44px]">
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
