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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card as FlashCard } from '@/types/lesson';
import { PRESET_TTS_LANGS } from '@/lib/tts';
import { detectLanguage } from '@/lib/langDetect';

interface CardEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialCard?: FlashCard | null;
  onSubmit: (values: {
    front: string;
    back: string;
    tags: string[];
    ttsLangFront?: string;
    ttsLangBack?: string;
    example?: string;
    ttsLangExample?: string;
  }) => void;
}

const tagsToString = (tags?: string[]) => (tags && tags.length ? tags.join(' ') : '');

const parseTags = (raw: string): string[] =>
  raw
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(Boolean);

const AUTO = '__auto__';

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
  const [langFront, setLangFront] = useState('');
  const [langBack, setLangBack] = useState('');
  const [example, setExample] = useState('');
  const [langExample, setLangExample] = useState('');

  useEffect(() => {
    if (open) {
      setFront(initialCard?.front ?? '');
      setBack(initialCard?.back ?? '');
      setTags(tagsToString(initialCard?.tags));
      setLangFront(initialCard?.ttsLangFront ?? '');
      setLangBack(initialCard?.ttsLangBack ?? '');
      setExample(initialCard?.example ?? '');
      setLangExample(initialCard?.ttsLangExample ?? '');
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
      ttsLangFront: langFront || undefined,
      ttsLangBack: langBack || undefined,
      example: trimmedExample || undefined,
      ttsLangExample: trimmedExample ? (langExample || undefined) : undefined,
    });
    onOpenChange(false);
  };

  const detectFront = () => {
    const d = detectLanguage(front);
    if (d) setLangFront(d);
  };
  const detectBack = () => {
    const d = detectLanguage(back);
    if (d) setLangBack(d);
  };
  const detectExample = () => {
    const d = detectLanguage(example);
    if (d) setLangExample(d);
  };

  const renderLangSelect = (
    value: string,
    onChange: (v: string) => void,
  ) => (
    <Select
      value={value || AUTO}
      onValueChange={v => onChange(v === AUTO ? '' : v)}
    >
      <SelectTrigger className="h-8 text-xs flex-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>{t('flashcards.cardLangAuto')}</SelectItem>
        <SelectGroup>
          <SelectLabel>{t('tts.commonLanguages')}</SelectLabel>
          {PRESET_TTS_LANGS.map(opt => (
            <SelectItem key={opt.code} value={opt.code}>
              {t(opt.labelKey)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

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
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground shrink-0">
                {t('flashcards.cardLangLabel')}
              </Label>
              {renderLangSelect(langFront, setLangFront)}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={detectFront}
                disabled={!trimmedFront}
                aria-label={t('flashcards.cardLangDetect')}
                title={t('flashcards.cardLangDetect')}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </div>
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
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground shrink-0">
                {t('flashcards.cardLangLabel')}
              </Label>
              {renderLangSelect(langBack, setLangBack)}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={detectBack}
                disabled={!trimmedBack}
                aria-label={t('flashcards.cardLangDetect')}
                title={t('flashcards.cardLangDetect')}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </div>
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
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground shrink-0">
                {t('flashcards.cardLangLabel')}
              </Label>
              {renderLangSelect(langExample, setLangExample)}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={detectExample}
                disabled={!trimmedExample}
                aria-label={t('flashcards.cardLangDetect')}
                title={t('flashcards.cardLangDetect')}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </div>
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
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {t('flashcards.cardLangHint')}
          </p>
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
