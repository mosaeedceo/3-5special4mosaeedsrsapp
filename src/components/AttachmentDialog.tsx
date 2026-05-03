import { useState, useMemo } from 'react';
import { Paperclip, StickyNote } from 'lucide-react';
import { Lesson, LessonAttachment } from '@/types/lesson';
import { FileAttachment } from './FileAttachment';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';
import { detectTextDirection } from '@/lib/textUtils';

interface AttachmentDialogProps {
  lesson: Lesson;
  onEdit: (id: string, updates: Partial<Lesson>) => void;
}

export const AttachmentDialog = ({ lesson, onEdit }: AttachmentDialogProps) => {
  const [open, setOpen] = useState(false);
  // Initialize as empty - only populate when dialog opens (lazy loading)
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const [notes, setNotes] = useState('');
  const { t, isRTL } = useTranslation();

  // Content-based RTL detection for notes
  const notesDirection = useMemo(() => {
    return notes ? detectTextDirection(notes) : (isRTL ? 'rtl' : 'ltr');
  }, [notes, isRTL]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Load attachments and notes only when dialog opens
      setAttachments(lesson.attachments || []);
      setNotes(lesson.notes || '');
    } else {
      // Clear attachments when dialog closes to free memory
      setAttachments([]);
      setNotes('');
    }
  };

  const handleAttachmentsChange = (newAttachments: LessonAttachment[]) => {
    setAttachments(newAttachments);
    onEdit(lesson.id, { attachments: newAttachments });
  };

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
  };

  const handleNotesSave = () => {
    onEdit(lesson.id, { notes: notes.trim() || undefined });
  };

  const attachmentCount = lesson.attachments?.length || 0;
  const hasNotes = !!lesson.notes?.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-muted-foreground hover:bg-primary/10 hover:text-primary relative"
        >
          <Paperclip className="w-4 h-4" />
          {(attachmentCount > 0 || hasNotes) && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center">
              {attachmentCount > 0 ? attachmentCount : '✎'}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" onSwipeClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="w-5 h-5" />
            {t('attachments.title')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          <p className="text-sm text-muted-foreground">
            {t('attachments.forLesson')} <strong>{lesson.title}</strong>
          </p>
          
          {/* Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">{t('attachments.studyNotes')}</span>
              {hasNotes && (
                <Badge variant="secondary" className="text-xs">{t('attachments.saved')}</Badge>
              )}
            </div>
            <Textarea
              placeholder={t('attachments.notesPlaceholder')}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={handleNotesSave}
              className="min-h-[120px] resize-none"
              dir={notesDirection}
            />
            <p className="text-xs text-muted-foreground">
              {t('attachments.autoSave')}
            </p>
          </div>
          
          {/* Attachments Section */}
          <FileAttachment
            attachments={attachments}
            onChange={handleAttachmentsChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
