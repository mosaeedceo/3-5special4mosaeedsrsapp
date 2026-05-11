import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/useTranslation';
import { Card as FlashCard } from '@/types/lesson';

interface CardEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialCard?: FlashCard | null;
  onSubmit: (values: {
    front: string;
    back: string;
    tags: string[];
    example?: string;
  }) => void;
}

const tagsToString = (tags?: string[]) => (tags && tags.length ? tags.join(' ') : '');

const parseTags = (raw: string): string[] =>
  raw
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(Boolean);

export const CardEditorDialog = ({
  open,
  onOpenChange,
  mode,
  initialCard,
  onSubmit,
}: CardEditorDialogProps) => {
  const { t } = useTranslation();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [example, setExample] = useState('');

  useEffect(() => {
    if (open) {
      setFront(initialCard?.front ?? '');
      setBack(initialCard?.back ?? '');
      setTags(tagsToString(initialCard?.tags));
      setExample(initialCard?.example ?? '');
    }
  }, [open, initialCard]);

  const trimmedFront = front.trim();
  const trimmedBack = back.trim();
  const canSave = trimmedFront.length > 0 && trimmedBack.length > 0;

  const trimmedExample = example.trim();

  const handleSubmit = () => {
    if (!canSave) return;
    onSubmit({
      front: trimmedFront,
      back: trimmedBack,
      tags: parseTags(tags),
      example: trimmedExample || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('flashcards.addCardTitle')
              : t('flashcards.editCardTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('flashcards.cardEditorDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="card-front">{t('flashcards.frontLabel')}</Label>
            <Textarea
              id="card-front"
              value={front}
              onChange={e => setFront(e.target.value)}
              placeholder={t('flashcards.frontPlaceholder')}
              rows={3}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-back">{t('flashcards.backLabel')}</Label>
            <Textarea
              id="card-back"
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder={t('flashcards.backPlaceholder')}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-example">{t('flashcards.exampleLabel')}</Label>
            <Textarea
              id="card-example"
              value={example}
              onChange={e => setExample(e.target.value)}
              placeholder={t('flashcards.examplePlaceholder')}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-tags">{t('flashcards.tagsLabel')}</Label>
            <Input
              id="card-tags"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder={t('flashcards.tagsPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('flashcards.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave}>
            {mode === 'create' ? t('flashcards.add') : t('flashcards.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
