/**
 * Detects if text content should be displayed in RTL direction
 * based on the presence of Arabic/Hebrew characters.
 */
export const detectTextDirection = (text: string): 'rtl' | 'ltr' => {
  if (!text) return 'ltr';
  
  // Check for Arabic/Hebrew/Persian characters
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  
  // Check first 100 chars for performance
  const sample = text.slice(0, 100);
  const hasRTL = rtlChars.test(sample);
  
  return hasRTL ? 'rtl' : 'ltr';
};
