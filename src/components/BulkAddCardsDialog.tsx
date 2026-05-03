import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  detectSeparator,
  isHeaderRow,
  parseCardText,
  parseDelimitedLine,
  type ParsedTextRow,
} from '@/lib/cardTextParser';

interface BulkAddCardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckName: string;
  onSubmit: (rows: ParsedTextRow[], options: { skipDuplicates: boolean }) => void;
}

type SepChoice = 'tab' | 'comma';

const sepChar = (s: SepChoice): '\t' | ',' => (s === 'tab' ? '\t' : ',');

/** Look at the first non-blank/non-comment row and decide if it's a header. */
const firstRowLooksLikeHeader = (text: string, sep: '\t' | ','): boolean => {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    return isHeaderRow(parseDelimitedLine(line, sep));
  }
  return false;
};

export const BulkAddCardsDialog = ({
  open,
  onOpenChange,
  deckName,
  onSubmit,
}: BulkAddCardsDialogProps) => {
  const { t, isRTL } = useTranslation();
  const [text, setText] = useState('');
  const [sep, setSep] = useState<SepChoice>('tab');
  const [skipHeader, setSkipHeader] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  // Track whether the user has manually toggled the checkbox/separator so
  // we stop overwriting their choice on every keystroke once they've decided.
  const [headerTouched, setHeaderTouched] = useState(false);
  const [sepTouched, setSepTouched] = useState(false);

  // Reset on open — including the "touched" flags so auto-detection works
  // again on every fresh bulk-add session.
  useEffect(() => {
    if (open) {
      setText('');
      setSep('tab');
      setSkipHeader(false);
      setSkipDuplicates(true);
      setHeaderTouched(false);
      setSepTouched(false);
    }
  }, [open]);
  useEffect(() => {
    if (!sepTouched && text.trim().length > 0) {
      const detected = detectSeparator(text.split(/\r?\n/).slice(0, 5).join('\n'));
      setSep(detected === '\t' ? 'tab' : 'comma');
    }
  }, [text, sepTouched]);

  // Auto-detect header until the user manually toggles the box.
  useEffect(() => {
    if (!headerTouched) {
      setSkipHeader(firstRowLooksLikeHeader(text, sepChar(sep)));
    }
  }, [text, sep, headerTouched]);

  const rows = useMemo<ParsedTextRow[]>(
    () =>
      parseCardText(text, {
        separator: sepChar(sep),
        header: skipHeader ? 'always' : 'never',
      }),
    [text, sep, skipHeader],
  );

  const count = rows.length;
  const canSubmit = count > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(rows, { skipDuplicates });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('flashcards.bulkAddTitle')}</DialogTitle>
          <DialogDescription>
            {t('flashcards.bulkAddDesc', { deck: deckName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
            <Label htmlFor="bulk-text">{t('flashcards.bulkPasteLabel')}</Label>
            <Textarea
              id="bulk-text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t('flashcards.bulkPlaceholder')}
              className="font-mono text-xs flex-1 min-h-[180px] resize-none"
              autoFocus
              dir="ltr"
            />
          </div>

          <div className={cn('flex items-center gap-3 flex-wrap', isRTL && 'flex-row-reverse')}>
            <Label className="text-xs text-muted-foreground">
              {t('flashcards.separatorLabel')}
            </Label>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => { setSep('tab'); setSepTouched(true); }}
                className={cn(
                  'px-3 py-1 text-xs',
                  sep === 'tab' ? 'bg-primary text-primary-foreground' : 'bg-background',
                )}
              >
                {t('flashcards.separatorTab')}
              </button>
              <button
                type="button"
                onClick={() => { setSep('comma'); setSepTouched(true); }}
                className={cn(
                  'px-3 py-1 text-xs border-l border-border',
                  sep === 'comma' ? 'bg-primary text-primary-foreground' : 'bg-background',
                )}
              >
                {t('flashcards.separatorComma')}
              </button>
            </div>
          </div>

          <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <Checkbox
              id="bulk-skip-header"
              checked={skipHeader}
              onCheckedChange={checked => {
                setSkipHeader(checked === true);
                setHeaderTouched(true);
              }}
            />
            <Label htmlFor="bulk-skip-header" className="text-xs cursor-pointer">
              {t('flashcards.skipHeader')}
            </Label>
          </div>

          <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <Checkbox
              id="bulk-skip-duplicates"
              checked={skipDuplicates}
              onCheckedChange={checked => setSkipDuplicates(checked === true)}
            />
            <Label htmlFor="bulk-skip-duplicates" className="text-xs cursor-pointer">
              {t('flashcards.skipDuplicates')}
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('flashcards.willAddCount', { count })}
          </p>

          {count > 0 ? (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('flashcards.bulkPreviewTitle')}
              </p>
              <ul className="space-y-1">
                {rows.slice(0, 5).map((row, idx) => (
                  <li
                    key={idx}
                    className="text-xs flex items-center gap-2 min-w-0"
                    dir="ltr"
                  >
                    <span className="truncate flex-1 text-foreground">{row.front}</span>
                    <span className="text-muted-foreground shrink-0">→</span>
                    <span className="truncate flex-1 text-muted-foreground">{row.back}</span>
                  </li>
                ))}
              </ul>
              {count > 5 && (
                <p className="text-[11px] text-muted-foreground">
                  {t('flashcards.bulkPreviewMore', { count: count - 5 })}
                </p>
              )}
            </div>
          ) : text.trim().length > 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t('flashcards.bulkPreviewNoRowsHint')}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('flashcards.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {t('flashcards.addCount', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
