import { isNativePlatform } from '@/lib/platform';
import { quotes } from './quotes';

const QUOTE_INDEX_KEY = 'quote-index';

export const getQuoteIndex = async (): Promise<number> => {
  try {
    if (isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      const result = await Preferences.get({ key: QUOTE_INDEX_KEY });
      return result.value ? parseInt(result.value, 10) : 0;
    } else {
      const stored = localStorage.getItem(QUOTE_INDEX_KEY);
      return stored ? parseInt(stored, 10) : 0;
    }
  } catch (e) {
    console.error('Error getting quote index:', e);
    return 0;
  }
};

export const incrementQuoteIndex = async (): Promise<number> => {
  try {
    const currentIndex = await getQuoteIndex();
    const newIndex = (currentIndex + 1) % quotes.length;
    
    if (isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: QUOTE_INDEX_KEY, value: newIndex.toString() });
    } else {
      localStorage.setItem(QUOTE_INDEX_KEY, newIndex.toString());
    }
    
    return newIndex;
  } catch (e) {
    console.error('Error incrementing quote index:', e);
    return 0;
  }
};

export const getCurrentQuote = async () => {
  const index = await getQuoteIndex();
  return quotes[index];
};
