import { isNativePlatform } from './platform';
import { ColorTheme } from '@/types/lesson';

// Save color theme to persistent storage
export const saveTheme = async (themeId: ColorTheme): Promise<void> => {
  try {
    if (isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: 'color-theme', value: themeId });
    } else {
      localStorage.setItem('color-theme', themeId);
    }
    console.log('[themeStorage] Theme saved:', themeId);
  } catch (error) {
    console.error('[themeStorage] Error saving theme:', error);
  }
};

// Load color theme from persistent storage
export const loadTheme = async (): Promise<ColorTheme | null> => {
  try {
    if (isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      const result = await Preferences.get({ key: 'color-theme' });
      if (result.value) {
        console.log('[themeStorage] Theme loaded from Preferences:', result.value);
        return result.value as ColorTheme;
      }
    } else {
      const stored = localStorage.getItem('color-theme');
      if (stored) {
        console.log('[themeStorage] Theme loaded from localStorage:', stored);
        return stored as ColorTheme;
      }
    }
    return null;
  } catch (error) {
    console.error('[themeStorage] Error loading theme:', error);
    return null;
  }
};

// Apply theme to document
export const applyTheme = (themeId: ColorTheme): void => {
  document.documentElement.setAttribute('data-theme', themeId);
  console.log('[themeStorage] Theme applied:', themeId);
};
