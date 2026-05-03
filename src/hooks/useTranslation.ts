import { useMemo, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { en, ar, type Language, type TranslationKeys } from '@/lib/translations';

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object
      ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
      : `${K}`
    }[keyof T & string]
  : never;

type TranslationKey = NestedKeyOf<TranslationKeys>;

const translations: Record<Language, TranslationKeys> = { en, ar };

/**
 * Get a nested value from an object using dot notation
 */
const getNestedValue = (obj: any, path: string): string => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      // Fallback to English if key not found
      return path;
    }
  }
  
  return typeof result === 'string' ? result : path;
};

/**
 * Replace placeholders like {count} with actual values
 */
const interpolate = (text: string, params?: Record<string, string | number>): string => {
  if (!params) return text;
  
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }, text);
};

/**
 * Standalone translation lookup for code that runs outside React (e.g.
 * the native notification scheduler). Mirrors the t() helper: nested-key
 * lookup, English fallback, and {placeholder} interpolation.
 */
export const translate = (
  language: Language,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const dict = translations[language] || translations.en;
  const value = getNestedValue(dict, key);
  if (value === key && language !== 'en') {
    return interpolate(getNestedValue(translations.en, key), params);
  }
  return interpolate(value, params);
};

export const useTranslation = () => {
  const { data } = useLocalStorage();
  const language = (data.settings as any).language as Language || 'en';
  
  const isRTL = language === 'ar';
  
  const currentTranslations = useMemo(() => {
    return translations[language] || translations.en;
  }, [language]);
  
  /**
   * Translate a key with optional parameter interpolation
   * @param key - Dot-notation key like 'nav.tasks' or 'home.lessonsToReview'
   * @param params - Optional parameters to interpolate, e.g., { count: 5 }
   */
  const t = useCallback((key: TranslationKey | string, params?: Record<string, string | number>): string => {
    const translation = getNestedValue(currentTranslations, key);
    
    // Fallback to English if translation is the key itself
    if (translation === key && language !== 'en') {
      const englishTranslation = getNestedValue(translations.en, key);
      return interpolate(englishTranslation, params);
    }
    
    return interpolate(translation, params);
  }, [currentTranslations, language]);
  
  /**
   * Format a date according to the current language
   */
  const formatDate = useCallback((date: Date, options?: Intl.DateTimeFormatOptions): string => {
    const locale = language === 'ar' ? 'ar-SA' : 'en-US';
    return date.toLocaleDateString(locale, options);
  }, [language]);
  
  /**
   * Format a number according to the current language
   * Note: We use Western numerals for both languages as they're more common in apps
   */
  const formatNumber = useCallback((num: number): string => {
    // Use Western numerals (more familiar in educational apps)
    return num.toLocaleString('en-US');
  }, []);
  
  return {
    t,
    language,
    isRTL,
    formatDate,
    formatNumber,
  };
};

// Export a simple hook to just get the language (for components that only need direction)
export const useLanguage = (): Language => {
  const { data } = useLocalStorage();
  return (data.settings as any).language as Language || 'en';
};
