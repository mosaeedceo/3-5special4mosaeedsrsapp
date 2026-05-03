import { getPlatform, isNativePlatform } from './platform';

export interface TTSVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/** Reason a speak() call failed — surfaced to the caller via onError. */
export type SpeakErrorKind =
  | 'unsupportedLang'   // language/voice data not installed for this lang
  | 'unavailable'       // engine never initialized / no engine on device
  | 'unknown';

export interface SpeakOptions {
  text: string;
  lang: string;             // BCP-47, e.g. "de-DE"
  voiceURI?: string;        // optional preferred voice URI
  rate?: number;            // 0.5 - 1.5
  /** Invoked when speech fails to play (cross-platform). */
  onError?: (err: { kind: SpeakErrorKind; lang: string; message?: string }) => void;
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

// ---------- Speaking-state tracking (cross-platform) ----------

type SpeakingListener = (speaking: boolean) => void;
const speakingListeners = new Set<SpeakingListener>();
let speakingState = false;

const setSpeakingState = (v: boolean): void => {
  if (speakingState === v) return;
  speakingState = v;
  speakingListeners.forEach(l => {
    try { l(v); } catch { /* ignore */ }
  });
};

/** Returns true while a TTS utterance is actively playing. */
export const isSpeaking = (): boolean => speakingState;

/**
 * Subscribe to speaking-state changes. Returns an unsubscribe function.
 * Listeners are invoked synchronously when the state changes.
 */
export const subscribeSpeaking = (cb: SpeakingListener): (() => void) => {
  speakingListeners.add(cb);
  return () => { speakingListeners.delete(cb); };
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
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onError?.({ kind: 'unavailable', lang: opts.lang });
    return;
  }
  const text = stripHtmlForSpeech(opts.text);
  if (!text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  setSpeakingState(false);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = opts.lang;
  utter.rate = clampRate(opts.rate);
  if (opts.voiceURI) {
    const match = synth.getVoices().find(v => v.voiceURI === opts.voiceURI);
    if (match) utter.voice = match;
  }
  utter.onstart = () => setSpeakingState(true);
  utter.onend = () => setSpeakingState(false);
  utter.onerror = (e) => {
    setSpeakingState(false);
    const err = e as SpeechSynthesisErrorEvent;
    const kind: SpeakErrorKind =
      err?.error === 'language-unavailable' || err?.error === 'voice-unavailable'
        ? 'unsupportedLang'
        : err?.error === 'synthesis-unavailable' || err?.error === 'audio-busy'
          ? 'unavailable'
          : 'unknown';
    opts.onError?.({ kind, lang: opts.lang, message: err?.error });
  };
  synth.speak(utter);
};

const webCancel = (): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  setSpeakingState(false);
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

/** Normalize a BCP-47 tag (accept "de_DE", "DE-de" → "de-DE"). */
const normalizeLangTag = (lang: string): string => {
  if (!lang) return lang;
  const parts = lang.replace('_', '-').split('-');
  if (parts.length === 0 || !parts[0]) return lang;
  const primary = parts[0].toLowerCase();
  const region = parts[1] ? parts[1].toUpperCase() : '';
  return region ? `${primary}-${region}` : primary;
};

/**
 * Find the best language tag actually supported by the engine.
 * Tries exact match, then primary subtag (e.g. "de"), then any installed
 * tag that starts with the primary subtag (e.g. "de-AT" when "de-DE" was asked).
 * Returns null if nothing matches.
 */
const resolveSupportedLang = async (
  tts: any,
  requested: string,
): Promise<string | null> => {
  const want = normalizeLangTag(requested);
  const primary = want.split('-')[0]?.toLowerCase();
  // Quick yes/no for the exact tag.
  try {
    const exact = await tts.isLanguageSupported({ lang: want });
    if (exact?.supported) return want;
  } catch { /* fall through */ }
  // Pull the full installed list and search.
  let installed: string[] = [];
  try {
    const res = await tts.getSupportedLanguages();
    installed = (res?.languages || []).map((l: string) => normalizeLangTag(l));
  } catch { /* ignore */ }
  if (installed.includes(want)) return want;
  if (primary && installed.includes(primary)) return primary;
  if (primary) {
    const sameLang = installed.find(l => l.toLowerCase().startsWith(primary + '-'));
    if (sameLang) return sameLang;
  }
  // Last-resort probe: ask about the primary subtag alone.
  if (primary) {
    try {
      const p = await tts.isLanguageSupported({ lang: primary });
      if (p?.supported) return primary;
    } catch { /* ignore */ }
  }
  return null;
};

const nativeSpeak = async (opts: SpeakOptions): Promise<void> => {
  const tts = await loadNative();
  if (!tts) { webSpeak(opts); return; }
  const text = stripHtmlForSpeech(opts.text);
  if (!text) return;
  try { await tts.stop(); } catch { /* ignore */ }
  setSpeakingState(false);

  // Resolve a language the engine actually supports — the plugin's `speak()`
  // hard-rejects with "This language is not supported." otherwise, which used
  // to silently fail before. Engine init is async, so retry briefly.
  let resolvedLang: string | null = null;
  for (let attempt = 0; attempt < 4 && !resolvedLang; attempt++) {
    resolvedLang = await resolveSupportedLang(tts, opts.lang);
    if (!resolvedLang) await new Promise(r => setTimeout(r, 150));
  }
  if (!resolvedLang) {
    console.warn('[tts] native speak: language not supported', opts.lang);
    opts.onError?.({ kind: 'unsupportedLang', lang: opts.lang });
    return;
  }

  // Voice index — the Android plugin returns voiceURI = Voice.getName(), so
  // exact-URI lookup works when the caller supplied one. Fall back to a
  // voice whose lang matches our resolved tag (or its primary subtag).
  let voiceIdx = -1;
  try {
    const voicesRes = await tts.getSupportedVoices();
    const voices: any[] = voicesRes?.voices || [];
    if (opts.voiceURI) {
      voiceIdx = voices.findIndex(v => v.voiceURI === opts.voiceURI);
    }
    if (voiceIdx < 0) {
      const want = resolvedLang.toLowerCase();
      const primary = want.split('-')[0];
      voiceIdx = voices.findIndex(v => normalizeLangTag(v.lang || '').toLowerCase() === want);
      if (voiceIdx < 0 && primary) {
        voiceIdx = voices.findIndex(v => (v.lang || '').toLowerCase().startsWith(primary));
      }
    }
  } catch { /* getSupportedVoices is optional for playback */ }

  // `category` is iOS-only in the plugin's TTSOptions; pass only on iOS.
  const isIOS = getPlatform() === 'ios';
  const speakOpts: Record<string, unknown> = {
    text,
    lang: resolvedLang,
    rate: clampRate(opts.rate),
    pitch: 1.0,
    volume: 1.0,
  };
  if (voiceIdx >= 0) speakOpts.voice = voiceIdx;
  if (isIOS) speakOpts.category = 'ambient';

  setSpeakingState(true);
  try {
    await tts.speak(speakOpts);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    console.warn('[tts] native speak failed', msg, { lang: resolvedLang, voiceIdx });
    const kind: SpeakErrorKind =
      /language is not supported/i.test(msg)
        ? 'unsupportedLang'
        : /not yet initialized|not available/i.test(msg)
          ? 'unavailable'
          : 'unknown';
    opts.onError?.({ kind, lang: opts.lang, message: msg });
  } finally {
    setSpeakingState(false);
  }
};

const nativeCancel = async (): Promise<void> => {
  const tts = await loadNative();
  if (!tts) { webCancel(); return; }
  try { await tts.stop(); } catch { /* ignore */ }
  setSpeakingState(false);
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
