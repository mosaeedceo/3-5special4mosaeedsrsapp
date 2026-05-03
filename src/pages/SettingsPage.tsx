import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ThemePicker } from '@/components/ThemePicker';
import { DisplayModeSelector } from '@/components/DisplayModeSelector';
import { DebugStorageDialog } from '@/components/DebugStorageDialog';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SessionHistory } from '@/components/SessionHistory';
import { Settings, Download, Upload, Sun, Moon, Monitor, Palette, LayoutGrid, Bug, Brain, GraduationCap, Paperclip, Languages, Clock, History, BookOpen, ChevronRight, ChevronLeft, Bell, BellOff, Volume2, ShieldAlert } from 'lucide-react';
import {
  scheduleDailyReminder,
  cancelReminder,
  requestReminderPermission,
} from '@/lib/reminders';
import { InstallVoicesDialog } from '@/components/InstallVoicesDialog';
import { isInstallSupported } from '@/lib/ttsInstaller';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { ColorTheme, DisplayMode } from '@/types/lesson';

export const SettingsPage = () => {
  const { data, updateSettings, exportData, importData, getTodayDueCount } = useLocalStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [installVoicesOpen, setInstallVoicesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { containerClass } = useDisplayMode(data.settings.displayMode);
  const { t, isRTL } = useTranslation();
  const navigate = useNavigate();

  const handleDisplayModeChange = (displayMode: DisplayMode) => {
    updateSettings({ displayMode });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const result = await importData(content);
      if (result === true) {
        toast.success(t('settings.importSuccess'));
      } else if (result && typeof result === 'object' && 'error' in result) {
        toast.error(result.error as string);
      } else {
        toast.error(t('settings.importFailed'));
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async (includeAttachments: boolean) => {
    setIsExporting(true);
    try {
      await exportData(includeAttachments);
      toast.success(includeAttachments ? t('settings.exportWithAttachmentsSuccess') : t('settings.exportSuccess'));
    } catch (error) {
      toast.error(t('settings.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
    localStorage.setItem('theme-mode', theme);
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  };

  const handleColorThemeChange = async (colorTheme: ColorTheme) => {
    const { saveTheme } = await import('@/lib/themeStorage');
    await saveTheme(colorTheme);
    localStorage.setItem('color-theme', colorTheme);
    updateSettings({ colorTheme });
    document.documentElement.setAttribute('data-theme', colorTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', data.settings.colorTheme || 'zinc');
  }, [data.settings.colorTheme]);

  const themeOptions = [
    { value: 'light', icon: Sun, label: t('settings.light') },
    { value: 'dark', icon: Moon, label: t('settings.dark') },
    { value: 'system', icon: Monitor, label: t('settings.system') },
  ] as const;

  const legacyCategories = data.categoryData.filter(c => c.isLegacyMode);
  const medicalBoardCategories = data.categoryData.filter(c => c.isMedicalBoardMode);

  return (
    <div className="min-h-screen bg-background pb-safe animate-fade-in">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 pt-8 pb-4">
        <div className={`${containerClass} mx-auto`}>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground text-xs font-medium">
              {t('settings.subtitle')}
            </span>
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            {t('settings.title')}
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className={`${containerClass} mx-auto px-4 py-6 space-y-4 sm:space-y-6`}>
        {/* User Guide */}
        <button
          onClick={() => navigate('/guide')}
          className="w-full animate-fade-in"
        >
          <Card className="border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
            <CardContent className="p-4 sm:p-5">
              <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className={cn("flex-1 text-left", isRTL && "text-right")}>
                  <h3 className="text-sm font-semibold text-foreground">{t('guide.title')}</h3>
                  <p className="text-xs text-muted-foreground">{t('guide.headerDesc').substring(0, 60)}...</p>
                </div>
                {isRTL ? (
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Language Selector */}
        <Card className="animate-fade-in">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Languages className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.language')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.languageDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <LanguageSelector />
          </CardContent>
        </Card>

        {/* Display Mode */}
        <Card className="animate-fade-in hidden md:block">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.displayMode')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.displayModeDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <DisplayModeSelector
              value={data.settings.displayMode || 'auto'}
              onChange={handleDisplayModeChange}
            />
          </CardContent>
        </Card>

        {/* Medical Board Mode Info */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.01s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.medicalBoardMode')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.medicalBoardModeDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs sm:text-sm text-foreground mb-2">
                <strong>{t('settings.medicalBoardPerCategory')}</strong>
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {t('settings.medicalBoardInstructions')}
              </p>
            </div>
            
            {medicalBoardCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">{t('settings.enabledCategories')}</p>
                <div className="flex flex-wrap gap-2">
                  {medicalBoardCategories.map(c => (
                    <span 
                      key={c.name} 
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium rounded-full bg-primary/20 text-primary"
                    >
                      <GraduationCap className="w-3 h-3" />
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Classic Mode Info */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.02s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-warning" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('legacy.title')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('legacy.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-xs sm:text-sm text-foreground mb-2">
                <strong>{t('legacy.perCategory')}</strong>
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {t('legacy.instructions')}
              </p>
            </div>
            
            {legacyCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">{t('legacy.categories')}</p>
                <div className="flex flex-wrap gap-2">
                  {legacyCategories.map(c => (
                    <span 
                      key={c.name} 
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium rounded-full bg-warning/20 text-warning"
                    >
                      <Clock className="w-3 h-3" />
                      {c.name}
                      {c.legacyIntervals && (
                        <span className="opacity-70">({c.legacyIntervals.join(', ')}d)</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FSRS Algorithm Settings */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.03s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.fsrsAlgorithm')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.fsrsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-medium">{t('settings.desiredRetention')}</label>
                <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                  {Math.round((data.settings.desiredRetention || 0.9) * 100)}%
                </span>
              </div>
              <Slider
                value={[(data.settings.desiredRetention || 0.9) * 100]}
                onValueChange={([value]) => updateSettings({ desiredRetention: value / 100 })}
                min={70}
                max={97}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground" dir="ltr">
                <span>70%</span>
                <span>90%</span>
                <span>97%</span>
              </div>
              
              {(() => {
                const retention = data.settings.desiredRetention || 0.9;
                return (
                  <div className={cn("grid grid-cols-3 gap-2 mt-3", isRTL && "flex-row-reverse")}>
                    <div className={cn(
                      "p-2 rounded-lg border text-center transition-all",
                      retention > 0.92 ? "bg-primary/20 border-primary" : "bg-muted/50 border-border"
                    )}>
                      <p className={cn("text-xs font-medium", retention > 0.92 ? "text-primary" : "text-muted-foreground")}>93-97%</p>
                      <p className="text-[10px] text-muted-foreground">{t('fsrs.moreReviews')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('fsrs.betterMemory')}</p>
                    </div>
                    <div className={cn(
                      "p-2 rounded-lg border text-center transition-all",
                      retention >= 0.8 && retention <= 0.92 ? "bg-success/20 border-success" : "bg-muted/50 border-border"
                    )}>
                      <p className={cn("text-xs font-medium", retention >= 0.8 && retention <= 0.92 ? "text-success" : "text-muted-foreground")}>80-92%</p>
                      <p className="text-[10px] text-muted-foreground">{t('fsrs.balanced')}</p>
                      <p className={cn("text-[10px] font-medium", retention >= 0.8 && retention <= 0.92 ? "text-success" : "text-muted-foreground")}>{t('fsrs.recommended')}</p>
                    </div>
                    <div className={cn(
                      "p-2 rounded-lg border text-center transition-all",
                      retention < 0.8 ? "bg-warning/20 border-warning" : "bg-muted/50 border-border"
                    )}>
                      <p className={cn("text-xs font-medium", retention < 0.8 ? "text-warning" : "text-muted-foreground")}>70-79%</p>
                      <p className="text-[10px] text-muted-foreground">{t('fsrs.fewerReviews')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('fsrs.moreForgetting')}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-medium">{t('settings.masteryThreshold')}</label>
                <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                  {data.settings.masteryStabilityDays || 21} {t('stats.days')}
                </span>
              </div>
              <Slider
                value={[data.settings.masteryStabilityDays || 21]}
                onValueChange={([value]) => updateSettings({ masteryStabilityDays: value })}
                min={7}
                max={90}
                step={7}
                className="w-full"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {t('settings.masteryThresholdDesc')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Color Theme */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.colorTheme')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.colorThemeDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <ThemePicker 
              currentTheme={data.settings.colorTheme || 'zinc'} 
              onThemeChange={handleColorThemeChange} 
            />
          </CardContent>
        </Card>

        {/* Light/Dark Mode */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Sun className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.appearance')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.appearanceDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {themeOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg border transition-all duration-200 min-h-[70px] sm:min-h-[80px] ${
                    data.settings.theme === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${data.settings.theme === value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-[10px] sm:text-sm font-medium ${data.settings.theme === value ? 'text-primary' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Download className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.dataManagement')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.dataManagementDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-2 sm:space-y-3">
            <Button 
              onClick={() => handleExport(false)} 
              variant="outline" 
              className="w-full min-h-[44px] text-sm"
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {t('settings.exportData')}
            </Button>
            <Button 
              onClick={() => handleExport(true)} 
              variant="outline" 
              className="w-full min-h-[44px] text-sm"
              disabled={isExporting}
            >
              <Paperclip className="w-4 h-4 mr-2" />
              {t('settings.exportWithAttachments')}
            </Button>
            <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
              {t('settings.exportFullDesc')}
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full min-h-[44px] text-sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('settings.importData')}
            </Button>
          </CardContent>
        </Card>

        {/* Study & Audio (TTS voices + leech threshold) */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.27s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.studyAndAudio')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {isInstallSupported() ? t('tts.installVoicesDesc') : t('tts.webHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-5">
            {isInstallSupported() && (
              <Button
                onClick={() => setInstallVoicesOpen(true)}
                variant="outline"
                className="w-full min-h-[44px] text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('tts.installVoices')}
              </Button>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {t('settings.leechThreshold')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(data.settings.leechThreshold ?? 0) > 0
                      ? t('settings.leechThresholdValue', {
                          count: data.settings.leechThreshold ?? 0,
                        })
                      : t('settings.leechThresholdOff')}
                  </span>
                  <Switch
                    checked={(data.settings.leechThreshold ?? 0) > 0}
                    onCheckedChange={on =>
                      updateSettings({ leechThreshold: on ? 8 : 0 })
                    }
                    aria-label={t('settings.leechThreshold')}
                  />
                </div>
              </div>
              {(data.settings.leechThreshold ?? 0) > 0 && (
                <Slider
                  min={4}
                  max={15}
                  step={1}
                  value={[Math.max(4, Math.min(15, data.settings.leechThreshold ?? 8))]}
                  onValueChange={([v]) => updateSettings({ leechThreshold: v })}
                  className="w-full"
                />
              )}
              <p className="text-xs text-muted-foreground">
                {t('settings.leechThresholdHint')}
              </p>
            </div>
            {(data.settings.leechThreshold ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium truncate">
                    {t('settings.quietLeechNotifications')}
                  </span>
                  <Switch
                    checked={!!data.settings.quietLeechNotifications}
                    onCheckedChange={on =>
                      updateSettings({ quietLeechNotifications: on })
                    }
                    aria-label={t('settings.quietLeechNotifications')}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('settings.quietLeechNotificationsHint')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <InstallVoicesDialog open={installVoicesOpen} onOpenChange={setInstallVoicesOpen} />

        {/* Study Reminders */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.28s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.reminders')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.remindersDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {data.settings.reminderEnabled ? (
                  <Bell className="w-4 h-4 text-primary" />
                ) : (
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{t('settings.reminderEnabled')}</span>
              </div>
              <button
                role="switch"
                aria-checked={!!data.settings.reminderEnabled}
                onClick={async () => {
                  const newValue = !data.settings.reminderEnabled;
                  updateSettings({ reminderEnabled: newValue });
                  if (newValue) {
                    const granted = await requestReminderPermission();
                    if (granted) {
                      const time = data.settings.reminderTime || '08:00';
                      const ok = await scheduleDailyReminder({
                        time,
                        dueCount: getTodayDueCount(),
                        lang: data.settings.language,
                      });
                      if (ok) toast.success(t('settings.reminderSet', { time }));
                    }
                  } else {
                    await cancelReminder();
                  }
                }}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  data.settings.reminderEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                  data.settings.reminderEnabled ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>

            {data.settings.reminderEnabled && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.reminderTime')}
                </label>
                <input
                  type="time"
                  value={data.settings.reminderTime || '08:00'}
                  onChange={async (e) => {
                    const time = e.target.value;
                    updateSettings({ reminderTime: time });
                    const ok = await scheduleDailyReminder({
                      time,
                      dueCount: getTodayDueCount(),
                      lang: data.settings.language,
                    });
                    if (ok) toast.success(t('settings.reminderSet', { time }));
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session History */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('sessionHistory.title')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('sessionHistory.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <SessionHistory />
          </CardContent>
        </Card>

        {/* Debug Storage */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.35s' }}>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Bug className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <CardTitle className="font-heading text-base sm:text-lg">{t('settings.debugStorage')}</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {t('settings.debugStorageDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <DebugStorageDialog />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
