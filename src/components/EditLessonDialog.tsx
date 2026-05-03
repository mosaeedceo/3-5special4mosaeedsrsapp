import { useState } from 'react';
import { format } from 'date-fns';
import { Lesson, Difficulty, DEFAULT_INTERVALS, LessonAttachment } from '@/types/lesson';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Pencil, ChevronDown, ChevronUp, Calendar as CalendarIcon, Paperclip, RotateCcw, Hash } from 'lucide-react';
import { IntervalPresets } from './IntervalPresets';
import { IntervalBuilder } from './IntervalBuilder';
import { FileAttachment } from './FileAttachment';
import { TagInput } from './TagInput';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface EditLessonDialogProps {
  lesson: Lesson;
  categories: string[];
  existingTags?: string[];
  onEdit: (id: string, updates: Partial<Lesson>) => void;
  onResetProgress?: (id: string) => void;
  showAttachments?: boolean;
  globalIntervals?: number[];
  useFSRS?: boolean;
}

export const EditLessonDialog = ({ 
  lesson, 
  categories, 
  existingTags = [],
  onEdit, 
  onResetProgress, 
  showAttachments = false, 
  globalIntervals = [1, 1, 4, 7, 14, 30], 
  useFSRS = false 
}: EditLessonDialogProps) => {
  const { t, isRTL } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [category, setCategory] = useState(lesson.category);
  const [subject, setSubject] = useState(lesson.subject);
  const [difficulty, setDifficulty] = useState<Difficulty>(lesson.difficulty);
  const [tags, setTags] = useState<string[]>(lesson.tags || []);
  
  // Start Date state
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(lesson.nextReviewDate));
  const [startDateOption, setStartDateOption] = useState<'today' | 'tomorrow' | 'custom'>('custom');
  
  // Custom intervals state
  const [useCustomIntervals, setUseCustomIntervals] = useState(!!lesson.customIntervals);
  const [lessonIntervals, setLessonIntervals] = useState<number[]>(
    lesson.customIntervals || DEFAULT_INTERVALS
  );
  const [intervalsExpanded, setIntervalsExpanded] = useState(false);
  
  // Attachments state
  const [attachments, setAttachments] = useState<LessonAttachment[]>(
    lesson.attachments || []
  );
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);

  const handleStartDateOptionChange = (option: 'today' | 'tomorrow' | 'custom') => {
    setStartDateOption(option);
    if (option === 'today') {
      setStartDate(new Date());
    } else if (option === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setStartDate(tomorrow);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category.trim() || !subject.trim()) return;

    onEdit(lesson.id, {
      title: title.trim(),
      category: category.trim(),
      subject: subject.trim(),
      difficulty,
      nextReviewDate: startDate ? startDate.toISOString() : lesson.nextReviewDate,
      customIntervals: useCustomIntervals ? lessonIntervals : undefined,
      attachments: showAttachments ? (attachments.length > 0 ? attachments : undefined) : lesson.attachments,
      tags: tags.length > 0 ? tags : undefined,
    });
    setOpen(false);
  };

  const handleResetProgress = () => {
    if (onResetProgress) {
      onResetProgress(lesson.id);
      setOpen(false);
    }
  };

  // Reset form state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTitle(lesson.title);
      setCategory(lesson.category);
      setSubject(lesson.subject);
      setDifficulty(lesson.difficulty);
      setStartDate(new Date(lesson.nextReviewDate));
      setStartDateOption('custom');
      setUseCustomIntervals(!!lesson.customIntervals);
      setLessonIntervals(lesson.customIntervals || DEFAULT_INTERVALS);
      setAttachments(lesson.attachments || []);
      setTags(lesson.tags || []);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:bg-primary/10 hover:text-primary">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-1.5rem)] max-h-[80vh] overflow-y-auto" onSwipeClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle className="font-heading text-base sm:text-lg">{t('lesson.editLesson')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
          <div className="space-y-1 sm:space-y-1.5">
            <Label htmlFor="edit-title" className="text-xs sm:text-sm">{t('lesson.title')}</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('lesson.lessonTitlePlaceholder')}
              className="text-sm h-9"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            <Label htmlFor="edit-category" className="text-xs sm:text-sm">{t('lesson.category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-sm" dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectValue placeholder={t('lesson.selectCategory')} />
              </SelectTrigger>
              <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} dir={isRTL ? 'rtl' : 'ltr'}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            <Label htmlFor="edit-subject" className="text-xs sm:text-sm">{t('lesson.subject')}</Label>
            <Input
              id="edit-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('lesson.subjectPlaceholder')}
              className="text-sm h-9"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            <Label className="text-xs sm:text-sm">{t('lesson.difficulty')}</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger className="h-9 text-sm" dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectItem value="Easy">{t('difficulties.Easy')}</SelectItem>
                <SelectItem value="Medium">{t('difficulties.Medium')}</SelectItem>
                <SelectItem value="Hard">{t('difficulties.Hard')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags Section */}
          <div className="space-y-1 sm:space-y-1.5">
            <Label className="text-xs sm:text-sm flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {t('tags.title')}
            </Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={existingTags}
              compact
            />
          </div>

          {/* Start Date Section */}
          <div className="space-y-1 sm:space-y-1.5">
            <Label className="text-xs sm:text-sm">{t('lesson.startDate')}</Label>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-1">
              {t('lesson.startDateDesc')}
            </p>
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 mb-1.5">
              <button
                type="button"
                onClick={() => handleStartDateOptionChange('today')}
                className={cn(
                  "px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs rounded-lg border transition-all min-h-[32px] sm:min-h-[36px]",
                  startDateOption === 'today'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                {t('lesson.today')}
              </button>
              <button
                type="button"
                onClick={() => handleStartDateOptionChange('tomorrow')}
                className={cn(
                  "px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs rounded-lg border transition-all min-h-[32px] sm:min-h-[36px]",
                  startDateOption === 'tomorrow'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                {t('lesson.tomorrow')}
              </button>
              <button
                type="button"
                onClick={() => handleStartDateOptionChange('custom')}
                className={cn(
                  "px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs rounded-lg border transition-all min-h-[32px] sm:min-h-[36px]",
                  startDateOption === 'custom'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                {t('lesson.custom')}
              </button>
            </div>
            
            {startDateOption === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal min-h-[36px] sm:min-h-[40px] text-xs sm:text-sm",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {startDate ? format(startDate, "PPP") : <span>{t('lesson.pickDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
            
            {startDate && (
              <p className="text-[10px] sm:text-xs text-primary">
                {t('lesson.reviewDate')} {format(startDate, "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Review Schedule Section - Hidden when FSRS is enabled */}
          {!useFSRS && (
            <Collapsible open={intervalsExpanded} onOpenChange={setIntervalsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between h-9 text-xs sm:text-sm"
                >
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {t('lesson.reviewSchedule')}
                    <span className="text-[10px] text-muted-foreground">
                      ({useCustomIntervals ? t('lesson.custom') : t('lesson.default')})
                    </span>
                  </span>
                  {intervalsExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom-intervals-toggle" className="text-xs sm:text-sm">
                    {t('lesson.useCustomSchedule')}
                  </Label>
                  <Switch
                    id="custom-intervals-toggle"
                    checked={useCustomIntervals}
                    onCheckedChange={setUseCustomIntervals}
                  />
                </div>

                {useCustomIntervals && (
                  <div className="space-y-3">
                    <IntervalPresets
                      currentIntervals={lessonIntervals}
                      onSelectPreset={setLessonIntervals}
                      compact
                    />
                    <IntervalBuilder
                      intervals={lessonIntervals}
                      onChange={setLessonIntervals}
                      compact
                    />
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Attachments Section - Only in Library */}
          {showAttachments && (
            <Collapsible open={attachmentsExpanded} onOpenChange={setAttachmentsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between h-9 text-xs sm:text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5" />
                    {t('lesson.attachments')}
                    {attachments.length > 0 && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                        {attachments.length}
                      </span>
                    )}
                  </span>
                  {attachmentsExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <FileAttachment
                  attachments={attachments}
                  onChange={setAttachments}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex gap-2 pt-2">
            {onResetProgress && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleResetProgress}
                className="flex items-center gap-1.5 text-warning hover:bg-warning/10 hover:text-warning h-9 text-xs sm:text-sm px-2 sm:px-3"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('lesson.resetProgress')}</span>
                <span className="sm:hidden">{t('actions.reset')}</span>
              </Button>
            )}
            <Button type="submit" className="flex-1 h-9 text-xs sm:text-sm">
              {t('lesson.saveChanges')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
