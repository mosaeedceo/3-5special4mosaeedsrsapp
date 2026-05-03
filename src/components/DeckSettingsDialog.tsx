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
import { Deck } from '@/types/lesson';
import { getVoices, PRESET_TTS_LANGS, speak, type TTSVoice } from '@/lib/tts';
import { isInstallSupported } from '@/lib/ttsInstaller';
import { InstallVoicesDialog } from '@/components/InstallVoicesDialog';
import { Volume2, Download } from 'lucide-react';

interface DeckSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: Deck | null;
  onSave: (updates: Partial<Deck>) => void;
}

const NONE = '__none__';
const ANY_VOICE = '__any__';

interface DraftState {
  ttsFrontLang: string;
  ttsFrontVoiceURI: string;
  ttsBackLang: string;
  ttsBackVoiceURI: string;
  ttsAutoPlay: boolean;
  ttsRate: number;
}

const initialDraft = (
  deck: Deck | null,
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
  };
};

/** Group voices by their BCP-47 language tag. */
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

export const DeckSettingsDialog = ({
  open,
  onOpenChange,
  deck,
  onSave,
}: DeckSettingsDialogProps) => {
  const { t } = useTranslation();
  const { data, updateSettings } = useLocalStorage();
  const lastTtsVoiceByLang = data.settings.lastTtsVoiceByLang || {};
  const [draft, setDraft] = useState<DraftState>(() => initialDraft(deck, lastTtsVoiceByLang));
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [voiceRefreshKey, setVoiceRefreshKey] = useState(0);

  useEffect(() => {
    if (open) setDraft(initialDraft(deck, lastTtsVoiceByLang));
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

  // Build language list: pinned presets first (with "(install voice)" if missing), then any other available languages.
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
    // If the persisted value is a preset that isn't currently installed,
    // we still need it to appear in the list (and remain selectable) so the
    // trigger renders the right label and the user can keep their choice.
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
              // Don't disable the currently-selected value, so it always renders correctly.
              const disabled = voicesLoaded && !opt.installed && !isCurrent;
              return (
                <SelectItem
                  key={opt.code}
                  value={opt.code}
                  disabled={disabled}
                >
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
    onSave({
      ttsFrontLang: draft.ttsFrontLang || undefined,
      ttsFrontVoiceURI: draft.ttsFrontLang ? (draft.ttsFrontVoiceURI || undefined) : undefined,
      ttsBackLang: draft.ttsBackLang || undefined,
      ttsBackVoiceURI: draft.ttsBackLang ? (draft.ttsBackVoiceURI || undefined) : undefined,
      ttsAutoPlay: draft.ttsAutoPlay,
      ttsRate: draft.ttsRate,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('tts.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('tts.dialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Front side */}
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

          {/* Back side */}
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

          {/* Auto-play */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="tts-autoplay">{t('tts.autoPlay')}</Label>
              <p className="text-xs text-muted-foreground">{t('tts.autoPlayHint')}</p>
            </div>
            <Switch
              id="tts-autoplay"
              checked={draft.ttsAutoPlay}
              onCheckedChange={v => setDraft(d => ({ ...d, ttsAutoPlay: v }))}
            />
          </div>

          {/* Rate */}
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
        </div>

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
