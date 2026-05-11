import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Deck, EasyDayLevel } from '@/types/lesson';

export type CustomStudyAction =
  | { type: 'extraNew'; count: number }
  | { type: 'extraReviews'; count: number }
  | { type: 'forgotten'; limit: number }
  | { type: 'ahead'; limit: number; days: number }
  | { type: 'previewNew'; limit: number }
  | { type: 'state'; state: 'new' | 'learning' | 'review' | 'relearning'; limit: number }
  | { type: 'tag'; tag: string; limit: number };

interface DeckSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: Deck | null;
  onSave: (updates: Partial<Deck>) => void;
  /**
   * Triggered when the user picks a Custom Study action. The dialog closes;
   * the parent is expected to apply any deck-state changes (e.g. todayBumps)
   * and navigate to a scoped review session.
   */
  onLaunchCustomStudy?: (action: CustomStudyAction) => void;
}

interface DraftState {
  // Daily limits (empty string = use global default)
  newPerDay: string;
  reviewsPerDay: string;
  newCardsIgnoreReviewLimit: boolean;
  limitsStartFromTop: boolean;
  // FSRS overrides
  retentionOverrideEnabled: boolean;
  retentionOverride: number; // 0.7 - 0.97
  leechOverrideEnabled: boolean;
  leechOverride: number; // 0 disables, otherwise lapse count
  // Easy Days (Mon..Sun)
  easyDays: EasyDayLevel[];
}

const DEFAULT_EASY_DAYS: EasyDayLevel[] = [
  'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal',
];

const initialDraft = (
  deck: Deck | null,
  globalRetention: number,
  globalLeech: number,
): DraftState => {
  return {
    newPerDay: deck?.newPerDay !== undefined ? String(deck.newPerDay) : '',
    reviewsPerDay: deck?.reviewsPerDay !== undefined ? String(deck.reviewsPerDay) : '',
    newCardsIgnoreReviewLimit: deck?.newCardsIgnoreReviewLimit ?? false,
    limitsStartFromTop: deck?.limitsStartFromTop ?? false,
    retentionOverrideEnabled: deck?.desiredRetentionOverride !== undefined,
    retentionOverride: deck?.desiredRetentionOverride ?? globalRetention,
    leechOverrideEnabled: deck?.leechThresholdOverride !== undefined,
    leechOverride: deck?.leechThresholdOverride ?? globalLeech,
    easyDays:
      deck?.easyDays && deck.easyDays.length === 7
        ? [...deck.easyDays]
        : [...DEFAULT_EASY_DAYS],
  };
};

const EASY_DAY_LEVELS: EasyDayLevel[] = ['min', 'reduced', 'normal'];

export const DeckSettingsDialog = ({
  open,
  onOpenChange,
  deck,
  onSave,
  onLaunchCustomStudy,
}: DeckSettingsDialogProps) => {
  const { t } = useTranslation();
  const { data } = useLocalStorage();
  const globalRetention = data.settings.desiredRetention ?? 0.9;
  const globalLeech = data.settings.leechThreshold ?? 0;
  const [draft, setDraft] = useState<DraftState>(() =>
    initialDraft(deck, globalRetention, globalLeech),
  );

  // Per-action pending input for Custom Study buttons.
  const [extraNewInput, setExtraNewInput] = useState('10');
  const [extraReviewsInput, setExtraReviewsInput] = useState('25');
  const [forgottenInput, setForgottenInput] = useState('20');
  const [aheadDaysInput, setAheadDaysInput] = useState('3');
  const [aheadLimitInput, setAheadLimitInput] = useState('20');
  const [previewLimitInput, setPreviewLimitInput] = useState('10');
  const [stateChoice, setStateChoice] = useState<'new' | 'learning' | 'review' | 'relearning'>('new');
  const [stateLimitInput, setStateLimitInput] = useState('20');
  const [tagInput, setTagInput] = useState('');
  const [tagLimitInput, setTagLimitInput] = useState('20');

  useEffect(() => {
    if (open) {
      setDraft(initialDraft(deck, globalRetention, globalLeech));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deck]);

  const handleSave = () => {
    const parseLimit = (s: string): number | undefined => {
      const trimmed = s.trim();
      if (!trimmed) return undefined;
      const n = parseInt(trimmed, 10);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return n;
    };

    const easyDaysAllNormal = draft.easyDays.every(l => l === 'normal');

    onSave({
      newPerDay: parseLimit(draft.newPerDay),
      reviewsPerDay: parseLimit(draft.reviewsPerDay),
      newCardsIgnoreReviewLimit: draft.newCardsIgnoreReviewLimit || undefined,
      limitsStartFromTop: draft.limitsStartFromTop || undefined,
      desiredRetentionOverride: draft.retentionOverrideEnabled
        ? Math.min(0.97, Math.max(0.7, draft.retentionOverride))
        : undefined,
      leechThresholdOverride: draft.leechOverrideEnabled
        ? Math.max(0, Math.floor(draft.leechOverride))
        : undefined,
      easyDays: easyDaysAllNormal ? undefined : draft.easyDays,
    });
    onOpenChange(false);
  };

  // Translated labels for Mon..Sun
  const dayLabels = [
    t('deckSettings.easyDays.mon'),
    t('deckSettings.easyDays.tue'),
    t('deckSettings.easyDays.wed'),
    t('deckSettings.easyDays.thu'),
    t('deckSettings.easyDays.fri'),
    t('deckSettings.easyDays.sat'),
    t('deckSettings.easyDays.sun'),
  ];
  const levelLabel = (l: EasyDayLevel) =>
    l === 'min'
      ? t('deckSettings.easyDays.min')
      : l === 'reduced'
        ? t('deckSettings.easyDays.reduced')
        : t('deckSettings.easyDays.normal');

  const launch = (action: CustomStudyAction) => {
    if (!onLaunchCustomStudy) return;
    onLaunchCustomStudy(action);
    onOpenChange(false);
  };

  const safeInt = (s: string, fallback: number, min = 0): number => {
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < min) return fallback;
    return n;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('deckSettings.title')}</DialogTitle>
          <DialogDescription>{t('deckSettings.desc')}</DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={['limits']} className="w-full">
          {/* ============ Daily Limits ============ */}
          <AccordionItem value="limits">
            <AccordionTrigger>{t('deckSettings.dailyLimits')}</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dl-new">{t('deckSettings.newPerDay')}</Label>
                <Input
                  id="dl-new"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder={t('deckSettings.usingGlobalDefault', { value: 20 })}
                  value={draft.newPerDay}
                  onChange={e => setDraft(d => ({ ...d, newPerDay: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dl-rev">{t('deckSettings.reviewsPerDay')}</Label>
                <Input
                  id="dl-rev"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder={t('deckSettings.usingGlobalDefault', { value: 200 })}
                  value={draft.reviewsPerDay}
                  onChange={e => setDraft(d => ({ ...d, reviewsPerDay: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('deckSettings.limitsBlankHint')}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="dl-ignore" className="cursor-pointer">
                  {t('deckSettings.newIgnoreReviewLimit')}
                </Label>
                <Switch
                  id="dl-ignore"
                  checked={draft.newCardsIgnoreReviewLimit}
                  onCheckedChange={v => setDraft(d => ({ ...d, newCardsIgnoreReviewLimit: v }))}
                  aria-label={t('deckSettings.newIgnoreReviewLimit')}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="dl-top" className="cursor-pointer">
                  {t('deckSettings.limitsStartFromTop')}
                </Label>
                <Switch
                  id="dl-top"
                  checked={draft.limitsStartFromTop}
                  onCheckedChange={v => setDraft(d => ({ ...d, limitsStartFromTop: v }))}
                  aria-label={t('deckSettings.limitsStartFromTop')}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ FSRS overrides ============ */}
          <AccordionItem value="fsrs">
            <AccordionTrigger>{t('deckSettings.fsrsSection')}</AccordionTrigger>
            <AccordionContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="fsrs-ret-toggle" className="cursor-pointer">
                    {t('deckSettings.retentionOverride')}
                  </Label>
                  <Switch
                    id="fsrs-ret-toggle"
                    checked={draft.retentionOverrideEnabled}
                    onCheckedChange={v => setDraft(d => ({ ...d, retentionOverrideEnabled: v }))}
                    aria-label={t('deckSettings.retentionOverride')}
                  />
                </div>
                {draft.retentionOverrideEnabled ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {t('settings.desiredRetention')}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round(draft.retentionOverride * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={70}
                      max={97}
                      step={1}
                      value={[Math.round(draft.retentionOverride * 100)]}
                      onValueChange={([v]) => setDraft(d => ({ ...d, retentionOverride: v / 100 }))}
                      aria-label={t('settings.desiredRetention')}
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('deckSettings.usingGlobalRetention', {
                      value: Math.round(globalRetention * 100),
                    })}
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="fsrs-leech-toggle" className="cursor-pointer">
                    {t('deckSettings.leechOverride')}
                  </Label>
                  <Switch
                    id="fsrs-leech-toggle"
                    checked={draft.leechOverrideEnabled}
                    onCheckedChange={v => setDraft(d => ({ ...d, leechOverrideEnabled: v }))}
                    aria-label={t('deckSettings.leechOverride')}
                  />
                </div>
                {draft.leechOverrideEnabled ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {t('settings.leechThreshold')}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {draft.leechOverride > 0
                          ? t('settings.leechThresholdValue', { count: draft.leechOverride })
                          : t('settings.leechThresholdOff')}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={15}
                      step={1}
                      value={[Math.max(0, Math.min(15, draft.leechOverride))]}
                      onValueChange={([v]) => setDraft(d => ({ ...d, leechOverride: v }))}
                      aria-label={t('settings.leechThreshold')}
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {globalLeech > 0
                      ? t('deckSettings.usingGlobalLeech', { value: globalLeech })
                      : t('deckSettings.usingGlobalLeechOff')}
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ Easy Days ============ */}
          <AccordionItem value="easydays">
            <AccordionTrigger>{t('deckSettings.easyDays.title')}</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('deckSettings.easyDays.desc')}
              </p>
              <div className="space-y-3">
                {dayLabels.map((dayName, i) => {
                  const level = draft.easyDays[i];
                  const idx = EASY_DAY_LEVELS.indexOf(level);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{dayName}</span>
                        <span className="text-muted-foreground">{levelLabel(level)}</span>
                      </div>
                      <Slider
                        min={0}
                        max={2}
                        step={1}
                        value={[idx >= 0 ? idx : 2]}
                        onValueChange={([v]) =>
                          setDraft(d => {
                            const next = [...d.easyDays];
                            next[i] = EASY_DAY_LEVELS[v] ?? 'normal';
                            return { ...d, easyDays: next };
                          })
                        }
                        aria-label={`${dayName} – ${levelLabel(level)}`}
                      />
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ============ Custom Study ============ */}
          {onLaunchCustomStudy && deck && (
            <AccordionItem value="customstudy">
              <AccordionTrigger>{t('deckSettings.customStudy.title')}</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {t('deckSettings.customStudy.desc')}
                </p>

                {/* Increase new */}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('deckSettings.customStudy.extraNew')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={extraNewInput}
                      onChange={e => setExtraNewInput(e.target.value)}
                      className="w-24"
                      aria-label={t('deckSettings.customStudy.extraNew')}
                    />
                    <Button
                      type="button"
                      onClick={() => launch({ type: 'extraNew', count: safeInt(extraNewInput, 10, 1) })}
                    >
                      {t('deckSettings.customStudy.start')}
                    </Button>
                  </div>
                </div>

                {/* Increase reviews */}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('deckSettings.customStudy.extraReviews')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={extraReviewsInput}
                      onChange={e => setExtraReviewsInput(e.target.value)}
                      className="w-24"
                      aria-label={t('deckSettings.customStudy.extraReviews')}
                    />
                    <Button
                      type="button"
                      onClick={() =>
                        launch({ type: 'extraReviews', count: safeInt(extraReviewsInput, 25, 1) })
                      }
                    >
                      {t('deckSettings.customStudy.start')}
                    </Button>
                  </div>
                </div>

                {/* Forgotten */}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('deckSettings.customStudy.forgotten')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={forgottenInput}
                      onChange={e => setForgottenInput(e.target.value)}
                      className="w-24"
                      aria-label={t('deckSettings.customStudy.forgotten')}
                    />
                    <Button
                      type="button"
                      onClick={() => launch({ type: 'forgotten', limit: safeInt(forgottenInput, 20, 1) })}
                    >
                      {t('deckSettings.customStudy.start')}
                    </Button>
                  </div>
                </div>

                {/* Review ahead */}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('deckSettings.customStudy.ahead')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-muted-foreground">
                        {t('deckSettings.customStudy.aheadDays')}
                      </span>
                      <Input
                        type="number"
                        min={1}
                        value={aheadDaysInput}
                        onChange={e => setAheadDaysInput(e.target.value)}
                        aria-label={t('deckSettings.customStudy.aheadDays')}
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground">
                        {t('deckSettings.customStudy.limit')}
                      </span>
                      <Input
                        type="number"
                        min={1}
                        value={aheadLimitInput}
                        onChange={e => setAheadLimitInput(e.target.value)}
                        aria-label={t('deckSettings.customStudy.limit')}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() =>
                      launch({
                        type: 'ahead',
                        days: safeInt(aheadDaysInput, 3, 1),
                        limit: safeInt(aheadLimitInput, 20, 1),
                      })
                    }
                  >
                    {t('deckSettings.customStudy.start')}
                  </Button>
                </div>

                {/* Preview new */}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('deckSettings.customStudy.previewNew')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={previewLimitInput}
                      onChange={e => setPreviewLimitInput(e.target.value)}
                      className="w-24"
                      aria-label={t('deckSettings.customStudy.previewNew')}
                    />
                    <Button
                      type="button"
                      onClick={() => launch({ type: 'previewNew', limit: safeInt(previewLimitInput, 10, 1) })}
                    >
                      {t('deckSettings.customStudy.start')}
                    </Button>
                  </div>
                </div>

                {/* By state or tag */}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('deckSettings.customStudy.byState')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={stateChoice}
                      onValueChange={v => setStateChoice(v as typeof stateChoice)}
                    >
                      <SelectTrigger aria-label={t('deckSettings.customStudy.byState')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{t('deckSettings.customStudy.stateNew')}</SelectItem>
                        <SelectItem value="learning">{t('deckSettings.customStudy.stateLearning')}</SelectItem>
                        <SelectItem value="review">{t('deckSettings.customStudy.stateReview')}</SelectItem>
                        <SelectItem value="relearning">{t('deckSettings.customStudy.stateRelearning')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={stateLimitInput}
                      onChange={e => setStateLimitInput(e.target.value)}
                      placeholder={t('deckSettings.customStudy.limit')}
                      aria-label={t('deckSettings.customStudy.limit')}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() =>
                      launch({
                        type: 'state',
                        state: stateChoice,
                        limit: safeInt(stateLimitInput, 20, 1),
                      })
                    }
                  >
                    {t('deckSettings.customStudy.start')}
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('deckSettings.customStudy.byTag')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      placeholder={t('deckSettings.customStudy.tagPlaceholder')}
                      aria-label={t('deckSettings.customStudy.byTag')}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={tagLimitInput}
                      onChange={e => setTagLimitInput(e.target.value)}
                      placeholder={t('deckSettings.customStudy.limit')}
                      aria-label={t('deckSettings.customStudy.limit')}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!tagInput.trim()}
                    onClick={() =>
                      launch({
                        type: 'tag',
                        tag: tagInput.trim(),
                        limit: safeInt(tagLimitInput, 20, 1),
                      })
                    }
                  >
                    {t('deckSettings.customStudy.start')}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('flashcards.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('flashcards.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
