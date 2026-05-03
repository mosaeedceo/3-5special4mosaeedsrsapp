import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTranslation } from '@/hooks/useTranslation';
import type { Language } from '@/types/lesson';
import { cn } from '@/lib/utils';
import { Languages } from 'lucide-react';

export const LanguageSelector = () => {
  const { data, updateSettings } = useLocalStorage();
  const { t } = useTranslation();
  const currentLanguage = data.settings.language || 'en';

  const handleLanguageChange = (language: Language) => {
    updateSettings({ language });
    // The RTLWrapper in App.tsx will handle updating the document direction
  };

  const languages = [
    { value: 'en' as Language, label: 'English', nativeLabel: 'English' },
    { value: 'ar' as Language, label: t('settings.arabic'), nativeLabel: 'العربية' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {languages.map(({ value, nativeLabel }) => (
        <button
          key={value}
          onClick={() => handleLanguageChange(value)}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200',
            currentLanguage === value
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50'
          )}
        >
          <Languages className={cn(
            'w-5 h-5',
            currentLanguage === value ? 'text-primary' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'text-sm font-medium',
            currentLanguage === value ? 'text-primary' : 'text-muted-foreground'
          )}>
            {nativeLabel}
          </span>
        </button>
      ))}
    </div>
  );
};
