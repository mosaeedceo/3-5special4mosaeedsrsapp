import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Lesson, Difficulty, LessonAttachment } from '@/types/lesson';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { Merge, AlertTriangle, FileText, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface MergeLessonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessons: Lesson[];
  onMerge: (mergedData: {
    title: string;
    category: string;
    subject: string;
    difficulty: Difficulty;
    includeNotes: string[];
    includeAttachments: string[];
  }) => void;
}

export const MergeLessonsDialog = ({
  open,
  onOpenChange,
  lessons,
  onMerge,
}: MergeLessonsDialogProps) => {
  const { t, isRTL } = useTranslation();

  // Get unique values from lessons
  const uniqueCategories = useMemo(() => 
    [...new Set(lessons.map(l => l.category))], [lessons]
  );
  const uniqueSubjects = useMemo(() => 
    [...new Set(lessons.map(l => l.subject).filter(Boolean))], [lessons]
  );
  
  const [title, setTitle] = useState(() => 
    lessons.length > 0 ? `${lessons[0].title} (Merged)` : ''
  );
  const [category, setCategory] = useState(() => lessons[0]?.category || '');
  const [subject, setSubject] = useState(() => lessons[0]?.subject || '');
  const [difficulty, setDifficulty] = useState<Difficulty>(() => lessons[0]?.difficulty || 'Medium');
  
  // Track which notes/attachments to include
  const [includeNotes, setIncludeNotes] = useState<Set<string>>(() => 
    new Set(lessons.filter(l => l.notes).map(l => l.id))
  );
  const [includeAttachments, setIncludeAttachments] = useState<Set<string>>(() => 
    new Set(lessons.filter(l => l.attachments?.length).map(l => l.id))
  );

  // Lessons with notes
  const lessonsWithNotes = useMemo(() => 
    lessons.filter(l => l.notes && l.notes.trim().length > 0), [lessons]
  );
  
  // Lessons with attachments
  const lessonsWithAttachments = useMemo(() => 
    lessons.filter(l => l.attachments && l.attachments.length > 0), [lessons]
  );

  // Total attachments count
  const totalAttachments = useMemo(() => 
    lessons.reduce((sum, l) => sum + (l.attachments?.length || 0), 0), [lessons]
  );

  const handleMerge = () => {
    onMerge({
      title,
      category,
      subject,
      difficulty,
      includeNotes: Array.from(includeNotes),
      includeAttachments: Array.from(includeAttachments),
    });
    onOpenChange(false);
  };

  const toggleNote = (lessonId: string) => {
    setIncludeNotes(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const toggleAttachment = (lessonId: string) => {
    setIncludeAttachments(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto" onSwipeClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-primary" />
            {t('merge.title')}
          </DialogTitle>
          <DialogDescription>
            {t('merge.description', { count: lessons.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('lesson.title')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('merge.enterTitle')}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>{t('lesson.category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectValue placeholder={t('lesson.selectCategory')} />
              </SelectTrigger>
              <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          {uniqueSubjects.length > 0 && (
            <div className="space-y-2">
              <Label>{t('lesson.subject')}</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                  <SelectValue placeholder={t('lesson.subjectPlaceholder')} />
                </SelectTrigger>
                <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                  {uniqueSubjects.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Difficulty */}
          <div className="space-y-2">
            <Label>{t('lesson.difficulty')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg border transition-all',
                    difficulty === d 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <DifficultyBadge difficulty={d} />
                  <span className="text-[10px] sm:text-sm">{t(`difficulties.${d}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes to include */}
          {lessonsWithNotes.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('merge.includeNotes')}
              </Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {lessonsWithNotes.map(lesson => (
                  <div 
                    key={lesson.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-muted/30"
                  >
                    <Checkbox
                      checked={includeNotes.has(lesson.id)}
                      onCheckedChange={() => toggleNote(lesson.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.notes!.length} {t('merge.characters')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments to include */}
          {lessonsWithAttachments.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                {t('merge.includeAttachments')} ({totalAttachments} {t('merge.total')})
              </Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {lessonsWithAttachments.map(lesson => (
                  <div 
                    key={lesson.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-muted/30"
                  >
                    <Checkbox
                      checked={includeAttachments.has(lesson.id)}
                      onCheckedChange={() => toggleAttachment(lesson.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.attachments!.length} {lesson.attachments!.length > 1 ? t('merge.files') : t('merge.file')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning">
              {t('merge.warning')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            {t('actions.cancel')}
          </Button>
          <Button 
            onClick={handleMerge}
            disabled={!title.trim() || !category}
            className="flex-1"
          >
            <Merge className="w-4 h-4 mr-2" />
            {t('merge.mergeLessons')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
