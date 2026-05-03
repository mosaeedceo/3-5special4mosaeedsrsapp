import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, CalendarIcon, ChevronDown, ChevronUp, Clock, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Difficulty, DEFAULT_INTERVALS, CategoryData } from '@/types/lesson';
import { cn } from '@/lib/utils';
import { IntervalPresets } from './IntervalPresets';
import { IntervalBuilder } from './IntervalBuilder';
import { TagInput } from './TagInput';
import { useTranslation } from '@/hooks/useTranslation';

interface AddLessonDialogProps {
  categories: string[];
  categoryData?: CategoryData[];
  existingTags?: string[];
  onAdd: (lesson: {
    title: string;
    category: string;
    subject: string;
    difficulty: Difficulty;
    startDate?: Date;
    customIntervals?: number[];
    tags?: string[];
  }) => void;
  useFSRS?: boolean;
  triggerClassName?: string;
  triggerIcon?: React.ReactNode;
}

export const AddLessonDialog = ({ 
  categories, 
  categoryData = [], 
  existingTags = [], 
  onAdd, 
  useFSRS = false,
  triggerClassName,
  triggerIcon,
}: AddLessonDialogProps) => {
  const { t, isRTL } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [startDateOption, setStartDateOption] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [tags, setTags] = useState<string[]>([]);
  
  // Custom intervals state
  const [useCustomIntervals, setUseCustomIntervals] = useState(false);
  const [lessonIntervals, setLessonIntervals] = useState<number[]>(DEFAULT_INTERVALS);
  const [intervalsExpanded, setIntervalsExpanded] = useState(false);

  // Check if selected category is in legacy mode
  const selectedCategoryData = useMemo(() => {
    const finalCategory = category === 'new' ? newCategory : category;
    return categoryData.find(c => c.name === finalCategory);
  }, [category, newCategory, categoryData]);

  const isSelectedCategoryLegacy = selectedCategoryData?.isLegacyMode || false;
  const legacyIntervals = selectedCategoryData?.legacyIntervals || DEFAULT_INTERVALS;

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
    
    const finalCategory = category === 'new' ? newCategory : category;
    
    if (!title || !finalCategory) return;

    onAdd({
      title,
      category: finalCategory,
      subject,
      difficulty,
      startDate,
      customIntervals: useCustomIntervals ? lessonIntervals : undefined,
      tags: tags.length > 0 ? tags : undefined,
    });

    // Reset form
    setTitle('');
    setCategory('');
    setNewCategory('');
    setSubject('');
    setDifficulty('Medium');
    setStartDate(new Date());
    setStartDateOption('today');
    setUseCustomIntervals(false);
    setLessonIntervals(DEFAULT_INTERVALS);
    setIntervalsExpanded(false);
    setTags([]);
    setOpen(false);
  };

  // Show interval settings for legacy categories OR when FSRS is disabled
  const showIntervalSettings = isSelectedCategoryLegacy || !useFSRS;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerClassName ? (
          <button className={triggerClassName} aria-label={t('lesson.addLesson')}>
            {triggerIcon || <Plus className="w-5 h-5" />}
          </button>
        ) : (
          <Button className="gradient-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 min-h-[44px]">
            <Plus className="w-5 h-5 mr-2" />
            {t('lesson.addLesson')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-1.5rem)] max-h-[80vh] overflow-y-auto" onSwipeClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle className={cn("font-heading text-base sm:text-lg", isRTL && "text-right")} dir={isRTL ? 'rtl' : 'ltr'}>{t('lesson.addNewLesson')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3 mt-2">
          <div className="space-y-1 sm:space-y-1.5">
            <Label htmlFor="title" className="text-xs sm:text-sm">{t('lesson.lessonTitle')}</Label>
            <Input
              id="title"
              placeholder={t('lesson.lessonTitlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="text-sm h-9"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            <Label htmlFor="category" className="text-xs sm:text-sm">{t('lesson.category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="text-sm h-9" dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectValue placeholder={t('lesson.selectCategory')} />
              </SelectTrigger>
              <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                {categories.map((cat) => {
                  const catData = categoryData.find(c => c.name === cat);
                  const isLegacy = catData?.isLegacyMode;
                  return (
                    <SelectItem key={cat} value={cat} dir={isRTL ? 'rtl' : 'ltr'}>
                      <div className="flex items-center gap-2">
                        <span>{cat}</span>
                        {isLegacy && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 text-warning border-warning/50">
                            <Clock className={cn("w-2.5 h-2.5", isRTL ? "ml-0.5" : "mr-0.5")} />
                            {t('lesson.legacyBadge')}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
                <SelectItem value="new" dir={isRTL ? 'rtl' : 'ltr'}>{t('lesson.newCategory')}</SelectItem>
              </SelectContent>
            </Select>
            {category === 'new' && (
              <Input
                placeholder={t('lesson.newCategoryPlaceholder')}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="mt-1.5 text-sm h-9"
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            )}
            
            {/* Legacy category indicator */}
            {isSelectedCategoryLegacy && (
              <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg bg-warning/10 border border-warning/30">
                <Clock className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                <p className="text-[10px] sm:text-xs text-warning">
                  {t('lesson.categoryUsesLegacy', { intervals: legacyIntervals.join(', ') })}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            <Label htmlFor="subject" className="text-xs sm:text-sm flex items-center gap-1">
              {t('lesson.subject')}
              <span className="text-muted-foreground font-normal">({t('fsrs.recommended')})</span>
            </Label>
            <Input
              id="subject"
              placeholder={t('lesson.subjectPlaceholder')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm h-9"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            <Label htmlFor="difficulty" className="text-xs sm:text-sm">{t('lesson.difficulty')}</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger className="text-sm h-9" dir={isRTL ? 'rtl' : 'ltr'}>
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
                {t('lesson.firstReview')} {format(startDate, "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Review Schedule Section - Show for Legacy categories or when FSRS is disabled */}
          {showIntervalSettings && (
            <Collapsible open={intervalsExpanded} onOpenChange={setIntervalsExpanded}>
              <div className="space-y-1.5 border rounded-lg p-2">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left min-h-[32px] sm:min-h-[36px]"
                  >
                    <div>
                      <Label className="cursor-pointer text-xs sm:text-sm">{t('lesson.reviewSchedule')}</Label>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                        {useCustomIntervals 
                          ? `${t('lesson.custom')}: ${lessonIntervals.join(', ')} ${t('categoryActions.days')}` 
                          : isSelectedCategoryLegacy
                            ? t('lesson.usingCategorySchedule', { intervals: legacyIntervals.join(', ') })
                            : t('lesson.usingDefault')}
                      </p>
                    </div>
                    {intervalsExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-2 sm:space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="custom-intervals" className="text-xs sm:text-sm">
                      {t('lesson.useCustomSchedule')}
                    </Label>
                    <Switch
                      id="custom-intervals"
                      checked={useCustomIntervals}
                      onCheckedChange={setUseCustomIntervals}
                    />
                  </div>

                  {useCustomIntervals && (
                    <div className="space-y-2 sm:space-y-3">
                      {/* Preset Templates */}
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground mb-1">{t('settings.quickPresets')}</p>
                        <IntervalPresets
                          currentIntervals={lessonIntervals}
                          onSelectPreset={setLessonIntervals}
                          compact
                        />
                      </div>

                      {/* Custom Builder */}
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground mb-1">{t('settings.customIntervals')}</p>
                        <IntervalBuilder
                          intervals={lessonIntervals}
                          onChange={setLessonIntervals}
                          compact
                        />
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          <div className="flex gap-2 pt-2 sm:pt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-[40px] text-xs sm:text-sm"
              onClick={() => setOpen(false)}
            >
              {t('actions.cancel')}
            </Button>
            <Button type="submit" className="flex-1 gradient-primary text-primary-foreground min-h-[40px] text-xs sm:text-sm">
              {t('lesson.addLesson')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
