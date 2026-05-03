import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import {
  checkLanguageStatus,
  isInstallSupported,
  openInstallTtsData,
  openTtsSettings,
  type TtsLanguageStatus,
} from '@/lib/ttsInstaller';
import { getVoices, PRESET_TTS_LANGS } from '@/lib/tts';
import { CheckCircle2, AlertCircle, Download, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface InstallVoicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoicesChanged?: () => void;
  /**
   * Optional list of BCP-47 language codes to offer for installation.
   * Defaults to ['de-DE', 'en-US'] when omitted.
   */
  langs?: string[];
}

const DEFAULT_LANGS = ['de-DE', 'en-US'];
const PRESET_LABEL_BY_CODE = new Map(PRESET_TTS_LANGS.map(p => [p.code, p.labelKey]));

const dedupe = (codes: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    if (!c) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
};

const StatusBadge = ({ status }: { status: TtsLanguageStatus | 'loading' }) => {
  const { t } = useTranslation();
  if (status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <RefreshCw className="w-3 h-3 animate-spin" />
        …
      </span>
    );
  }
  if (status === 'installed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {t('tts.installed')}
      </span>
    );
  }
  if (status === 'engineMissing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning font-medium">
        <AlertCircle className="w-3.5 h-3.5" />
        {t('tts.engineMissing')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
      <AlertCircle className="w-3.5 h-3.5" />
      {t('tts.notInstalled')}
    </span>
  );
};

export const InstallVoicesDialog = ({ open, onOpenChange, onVoicesChanged, langs }: InstallVoicesDialogProps) => {
  const { t } = useTranslation();
  const [statuses, setStatuses] = useState<Record<string, TtsLanguageStatus | 'loading'>>({});
  const supported = isInstallSupported();

  const langList = useMemo(() => {
    const codes = langs && langs.length > 0
      ? dedupe([...langs, ...DEFAULT_LANGS])
      : [...DEFAULT_LANGS];
    return codes.map(code => {
      const labelKey = PRESET_LABEL_BY_CODE.get(code);
      return { code, label: labelKey ? t(labelKey) : code };
    });
  }, [langs, t]);

  const refresh = useCallback(async () => {
    setStatuses(s => {
      const next: Record<string, TtsLanguageStatus | 'loading'> = { ...s };
      for (const l of langList) next[l.code] = 'loading';
      return next;
    });
    const results = await Promise.all(langList.map(l => checkLanguageStatus(l.code)));
    const next: Record<string, TtsLanguageStatus> = {};
    langList.forEach((l, i) => { next[l.code] = results[i]; });
    setStatuses(next);
    // Refresh voice list so external listeners pick up newly installed voices.
    try {
      await getVoices();
      onVoicesChanged?.();
    } catch { /* ignore */ }
  }, [onVoicesChanged, langList]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [open, refresh]);

  const handleInstall = async (code: string) => {
    try {
      await openInstallTtsData(code);
    } catch (err: any) {
      toast.error(err?.message || t('tts.engineMissing'));
    }
  };

  const handleOpenSettings = async () => {
    try {
      await openTtsSettings();
    } catch (err: any) {
      toast.error(err?.message || t('tts.engineMissing'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tts.installDialogTitle')}</DialogTitle>
          <DialogDescription>{t('tts.installDialogDesc')}</DialogDescription>
        </DialogHeader>

        {!supported ? (
          <p className="text-sm text-muted-foreground py-4">{t('tts.webHint')}</p>
        ) : (
          <div className="space-y-3 py-2">
            {langList.map(l => {
              const status = statuses[l.code] || 'loading';
              const canInstall = status === 'missing' || status === 'installed';
              return (
                <div
                  key={l.code}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">
                      {l.label}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={status === 'installed' ? 'outline' : 'default'}
                    onClick={() => handleInstall(l.code)}
                    disabled={!canInstall}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {t('tts.install')}
                  </Button>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleOpenSettings}
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              {t('tts.openSystemSettings')}
            </Button>
          </div>
        )}

        <DialogFooter>
          {supported && (
            <Button variant="ghost" onClick={() => void refresh()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('tts.refreshStatus')}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>{t('flashcards.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
