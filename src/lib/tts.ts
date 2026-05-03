import { isNativePlatform } from './platform';

export interface TTSVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

export interface SpeakOptions {
  text: string;
  lang: string;             // BCP-47, e.g. "de-DE"
  voiceURI?: string;        // optional preferred voice URI
  rate?: number;            // 0.5 - 1.5
}

/** Strip HTML tags & decode entities → plain text suitable for speech. */
export const stripHtmlForSpeech = (html: string): string => {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    // Drop [sound:...] markers since we don't speak attached audio
    const text = (div.textContent || div.innerText || '').replace(/\[sound:[^\]]+\]/gi, '');
    return text.replace(/\s+/g, ' ').trim();
  }
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[sound:[^\]]+\]/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const clampRate = (r?: number): number => {
  const n = typeof r === 'number' && isFinite(r) ? r : 1.0;
  return Math.max(0.5, Math.min(1.5, n));
};

// ---------- Web implementation ----------

const webGetVoices = (): Promise<TTSVoice[]> => {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const collect = (): TTSVoice[] =>
      synth.getVoices().map(v => ({
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        localService: (v as SpeechSynthesisVoice).localService,
        default: (v as SpeechSynthesisVoice).default,
      }));
    const initial = collect();
    if (initial.length > 0) {
      resolve(initial);
      return;
    }
    // Voices may load asynchronously
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(collect());
    };
    synth.addEventListener('voiceschanged', handler);
    // Safety fallback
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(collect());
    }, 1500);
  });
};

const webSpeak = (opts: SpeakOptions): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const text = stripHtmlForSpeech(opts.text);
  if (!text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = opts.lang;
  utter.rate = clampRate(opts.rate);
  if (opts.voiceURI) {
    const match = synth.getVoices().find(v => v.voiceURI === opts.voiceURI);
    if (match) utter.voice = match;
  }
  synth.speak(utter);
};

const webCancel = (): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
};

// ---------- Native (Capacitor) implementation ----------

let nativeModulePromise: Promise<any> | null = null;
const loadNative = (): Promise<any> => {
  if (!nativeModulePromise) {
    nativeModulePromise = import('@capacitor-community/text-to-speech')
      .then(mod => mod.TextToSpeech)
      .catch(err => {
        console.warn('[tts] native module unavailable, falling back to web', err);
        return null;
      });
  }
  return nativeModulePromise;
};

const nativeGetVoices = async (): Promise<TTSVoice[]> => {
  const tts = await loadNative();
  if (!tts) return webGetVoices();
  try {
    const res = await tts.getSupportedVoices();
    const voices = res?.voices || [];
    return voices.map((v: any) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      default: v.default,
    }));
  } catch (err) {
    console.warn('[tts] getSupportedVoices failed', err);
    return [];
  }
};

const nativeSpeak = async (opts: SpeakOptions): Promise<void> => {
  const tts = await loadNative();
  if (!tts) { webSpeak(opts); return; }
  const text = stripHtmlForSpeech(opts.text);
  if (!text) return;
  try { await tts.stop(); } catch { /* ignore */ }
  try {
    const voices: any[] = (await tts.getSupportedVoices())?.voices || [];
    const idx = opts.voiceURI
      ? voices.findIndex(v => v.voiceURI === opts.voiceURI)
      : -1;
    await tts.speak({
      text,
      lang: opts.lang,
      rate: clampRate(opts.rate),
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
      ...(idx >= 0 ? { voice: idx } : {}),
    });
  } catch (err) {
    console.warn('[tts] native speak failed', err);
  }
};

const nativeCancel = async (): Promise<void> => {
  const tts = await loadNative();
  if (!tts) { webCancel(); return; }
  try { await tts.stop(); } catch { /* ignore */ }
};

// ---------- Public API ----------

export const getVoices = async (): Promise<TTSVoice[]> => {
  return isNativePlatform() ? nativeGetVoices() : webGetVoices();
};

export const speak = (opts: SpeakOptions): void => {
  if (isNativePlatform()) {
    void nativeSpeak(opts);
  } else {
    webSpeak(opts);
  }
};

export const cancel = (): void => {
  if (isNativePlatform()) {
    void nativeCancel();
  } else {
    webCancel();
  }
};

/** Common preset languages pinned to the top of voice pickers. */
export const PRESET_TTS_LANGS: { code: string; labelKey: string }[] = [
  { code: 'de-DE', labelKey: 'tts.langDeDE' },
  { code: 'en-US', labelKey: 'tts.langEnUS' },
  { code: 'en-GB', labelKey: 'tts.langEnGB' },
  { code: 'es-ES', labelKey: 'tts.langEsES' },
  { code: 'fr-FR', labelKey: 'tts.langFrFR' },
  { code: 'it-IT', labelKey: 'tts.langItIT' },
  { code: 'ar-SA', labelKey: 'tts.langArSA' },
];
