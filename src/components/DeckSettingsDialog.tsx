import { useEffect, useMemo, useState } from 'react';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Deck, EasyDayLevel } from '@/types/lesson';
import { getVoices, PRESET_TTS_LANGS, speak, type TTSVoice } from '@/lib/tts';
import { isInstallSupported } from '@/lib/ttsInstaller';
import { InstallVoicesDialog } from '@/components/InstallVoicesDialog';
import { Volume2, Download } from 'lucide-react';

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

const NONE = '__none__';
const ANY_VOICE = '__any__';

interface DraftState {
  // TTS
  ttsFrontLang: string;
  ttsFrontVoiceURI: string;
  ttsBackLang: string;
  ttsBackVoiceURI: string;
  ttsAutoPlay: boolean;
  ttsRate: number;
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
  lastByLang: Record<string, string> = {},
): DraftState => {
  const frontLang = deck?.ttsFrontLang || '';
  const backLang = deck?.ttsBackLang || '';
  return {
    ttsFrontLang: frontLang,
    ttsFrontVoiceURI: deck?.ttsFrontVoiceURI || (frontLang ? lastByLang[frontLang] || '' : ''),
    ttsBackLang: backLang,
    ttsBackVoiceURI: deck?.ttsBackVoiceURI || (backLang ? lastByLang[backLang] || '' : ''),
    ttsAutoPlay: deck?.ttsAutoPlay ?? false,
    ttsRate: deck?.ttsRate ?? 1.0,
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

const groupByLang = (voices: TTSVoice[]): Map<string, TTSVoice[]> => {
  const map = new Map<string, TTSVoice[]>();
  for (const v of voices) {
    if (!v.lang) continue;
    const list = map.get(v.lang) || [];
    list.push(v);
    map.set(v.lang, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return map;
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
  const { data, updateSettings } = useLocalStorage();
  const lastTtsVoiceByLang = data.settings.lastTtsVoiceByLang || {};
  const globalRetention = data.settings.desiredRetention ?? 0.9;
  const globalLeech = data.settings.leechThreshold ?? 0;
  const [draft, setDraft] = useState<DraftState>(() =>
    initialDraft(deck, globalRetention, globalLeech, lastTtsVoiceByLang),
  );
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [voiceRefreshKey, setVoiceRefreshKey] = useState(0);

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
      setDraft(initialDraft(deck, globalRetention, globalLeech, lastTtsVoiceByLang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deck]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setVoicesLoaded(false);
    getVoices().then(v => {
      if (cancelled) return;
      setVoices(v);
      setVoicesLoaded(true);
    });
    return () => { cancelled = true; };
  }, [open, voiceRefreshKey]);

  const voicesByLang = useMemo(() => groupByLang(voices), [voices]);
  const availableLangs = useMemo(() => Array.from(voicesByLang.keys()).sort(), [voicesByLang]);

  const langOptions = useMemo(() => {
    const presetCodes = new Set(PRESET_TTS_LANGS.map(p => p.code));
    const presets = PRESET_TTS_LANGS.map(p => ({
      code: p.code,
      label: t(p.labelKey),
      installed: voicesByLang.has(p.code),
    }));
    const extras = availableLangs
      .filter(l => !presetCodes.has(l))
      .map(l => ({ code: l, label: l, installed: true }));
    return { presets, extras };
  }, [voicesByLang, availableLangs, t]);

  const renderLangSelect = (
    value: string,
    onChange: (v: string) => void,
  ) => {
    const presetCodes = new Set(PRESET_TTS_LANGS.map(p => p.code));
    const valueIsExtra = !!value && !presetCodes.has(value) && !voicesByLang.has(value);
    return (
      <Select
        value={value || NONE}
        onValueChange={v => onChange(v === NONE ? '' : v)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('tts.langNone')}</SelectItem>
          <SelectGroup>
            <SelectLabel>{t('tts.commonLanguages')}</SelectLabel>
            {langOptions.presets.map(opt => {
              const isCurrent = opt.code === value;
              const disabled = voicesLoaded && !opt.installed && !isCurrent;
              return (
                <SelectItem key={opt.code} value={opt.code} disabled={disabled}>
                  {opt.label}
                  {voicesLoaded && !opt.installed ? ` ${t('tts.installVoice')}` : ''}
                </SelectItem>
              );
            })}
          </SelectGroup>
          {langOptions.extras.length > 0 && (
            <SelectGroup>
              <SelectLabel>{t('tts.otherLanguages')}</SelectLabel>
              {langOptions.extras.map(opt => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {valueIsExtra && (
            <SelectItem value={value}>{value}</SelectItem>
          )}
        </SelectContent>
      </Select>
    );
  };

  const renderVoiceSelect = (
    lang: string,
    value: string,
    onChange: (v: string) => void,
  ) => {
    const list = voicesByLang.get(lang) || [];
    if (!lang) return null;
    return (
      <Select
        value={value || ANY_VOICE}
        onValueChange={v => onChange(v === ANY_VOICE ? '' : v)}
        disabled={list.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('tts.defaultVoice')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_VOICE}>{t('tts.defaultVoice')}</SelectItem>
          {list.map(v => (
            <SelectItem key={v.voiceURI} value={v.voiceURI}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const handleSave = () => {
    const merged = { ...lastTtsVoiceByLang };
    if (draft.ttsFrontLang) {
      if (draft.ttsFrontVoiceURI) merged[draft.ttsFrontLang] = draft.ttsFrontVoiceURI;
      else delete merged[draft.ttsFrontLang];
    }
    if (draft.ttsBackLang) {
      if (draft.ttsBackVoiceURI) merged[draft.ttsBackLang] = draft.ttsBackVoiceURI;
      else delete merged[draft.ttsBackLang];
    }
    const prevKeys = Object.keys(lastTtsVoiceByLang);
    const mergedKeys = Object.keys(merged);
    const changed =
      mergedKeys.length !== prevKeys.length ||
      mergedKeys.some(k => merged[k] !== lastTtsVoiceByLang[k]);
    if (changed) {
      updateSettings({ lastTtsVoiceByLang: merged });
    }

    const parseLimit = (s: string): number | undefined => {
      const trimmed = s.trim();
      if (!trimmed) return undefined;
      const n = parseInt(trimmed, 10);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return n;
    };

    const easyDaysAllNormal = draft.easyDays.every(l => l === 'normal');

    onSave({
      ttsFrontLang: draft.ttsFrontLang || undefined,
      ttsFrontVoiceURI: draft.ttsFrontLang ? (draft.ttsFrontVoiceURI || undefined) : undefined,
      ttsBackLang: draft.ttsBackLang || undefined,
      ttsBackVoiceURI: draft.ttsBackLang ? (draft.ttsBackVoiceURI || undefined) : undefined,
      ttsAutoPlay: draft.ttsAutoPlay,
      ttsRate: draft.ttsRate,
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

  const previewSample = (lang: string, voiceURI: string) => {
    if (!lang) return;
    speak({
      text: t('tts.previewSample'),
      lang,
      voiceURI: voiceURI || undefined,
      rate: draft.ttsRate,
    });
  };

  const hasMissingPreset = voicesLoaded && langOptions.presets.some(p => !p.installed);
  const selectedLangs = [draft.ttsFrontLang, draft.ttsBackLang].filter(Boolean);
  const showInstallEntry =
    isInstallSupported() &&
    (hasMissingPreset || selectedLangs.some(l => !voicesByLang.has(l)));

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

        <Accordion type="multiple" defaultValue={['tts']} className="w-full">
          {/* ============ TTS section (existing) ============ */}
          <AccordionItem value="tts">
            <AccordionTrigger>{t('deckSettings.ttsSection')}</AccordionTrigger>
            <AccordionContent className="space-y-5">
              <div className="space-y-2">
                <Label>{t('tts.frontLanguage')}</Label>
                {renderLangSelect(draft.ttsFrontLang, v =>
                  setDraft(d => ({ ...d, ttsFrontLang: v, ttsFrontVoiceURI: v ? (lastTtsVoiceByLang[v] || '') : '' })),
                )}
                {draft.ttsFrontLang && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {renderVoiceSelect(draft.ttsFrontLang, draft.ttsFrontVoiceURI, v =>
                        setDraft(d => ({ ...d, ttsFrontVoiceURI: v })),
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => previewSample(draft.ttsFrontLang, draft.ttsFrontVoiceURI)}
                      aria-label={t('tts.preview')}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('tts.backLanguage')}</Label>
                {renderLangSelect(draft.ttsBackLang, v =>
                  setDraft(d => ({ ...d, ttsBackLang: v, ttsBackVoiceURI: v ? (lastTtsVoiceByLang[v] || '') : '' })),
                )}
                {draft.ttsBackLang && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {renderVoiceSelect(draft.ttsBackLang, draft.ttsBackVoiceURI, v =>
                        setDraft(d => ({ ...d, ttsBackVoiceURI: v })),
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => previewSample(draft.ttsBackLang, draft.ttsBackVoiceURI)}
                      aria-label={t('tts.preview')}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="tts-autoplay">{t('tts.autoPlay')}</Label>
                  <p className="text-xs text-muted-foreground">{t('tts.autoPlayHint')}</p>
                </div>
                <Switch
                  id="tts-autoplay"
                  checked={draft.ttsAutoPlay}
                  onCheckedChange={v => setDraft(d => ({ ...d, ttsAutoPlay: v }))}
                  aria-label={t('tts.autoPlay')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('tts.rate')}</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {draft.ttsRate.toFixed(2)}x
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={[draft.ttsRate]}
                  onValueChange={([v]) => setDraft(d => ({ ...d, ttsRate: v }))}
                  aria-label={t('tts.rate')}
                />
              </div>

              {hasMissingPreset && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t('tts.installVoiceHint')}
                </p>
              )}

              {showInstallEntry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setInstallOpen(true)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('tts.installVoices')}
                </Button>
              )}
            </AccordionContent>
          </AccordionItem>

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

        <InstallVoicesDialog
          open={installOpen}
          onOpenChange={setInstallOpen}
          onVoicesChanged={() => setVoiceRefreshKey(k => k + 1)}
          langs={selectedLangs}
        />

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
