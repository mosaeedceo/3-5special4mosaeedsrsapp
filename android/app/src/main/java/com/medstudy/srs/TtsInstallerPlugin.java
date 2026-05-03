package com.medstudy.srs;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.TextToSpeech.EngineInfo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "TtsInstaller")
public class TtsInstallerPlugin extends Plugin {

    private static Locale parseLocale(String tag) {
        if (tag == null || tag.isEmpty()) return null;
        String normalized = tag.replace('_', '-');
        try {
            Locale loc = Locale.forLanguageTag(normalized);
            if (loc == null || loc.getLanguage().isEmpty()) {
                String[] parts = normalized.split("-");
                if (parts.length >= 2) return new Locale(parts[0], parts[1]);
                if (parts.length == 1) return new Locale(parts[0]);
                return null;
            }
            return loc;
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void openInstallTtsData(PluginCall call) {
        String lang = call.getString("language");
        try {
            Intent intent = new Intent();
            intent.setAction(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (lang != null && !lang.isEmpty()) {
                intent.putExtra("language", lang);
            }
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No TTS engine available to install voice data", e);
        } catch (Exception e) {
            call.reject("Failed to open install TTS data: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openTtsSettings(PluginCall call) {
        try {
            Intent intent = new Intent("com.android.settings.TTS_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
                call.resolve();
                return;
            } catch (ActivityNotFoundException ignored) {
                // fall through to fallback
            }
            Intent fallback = new Intent("android.settings.VOICE_INPUT_SETTINGS");
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open TTS settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void checkLanguage(final PluginCall call) {
        final String lang = call.getString("language");
        final Locale locale = parseLocale(lang);
        if (locale == null) {
            JSObject ret = new JSObject();
            ret.put("status", "missing");
            call.resolve(ret);
            return;
        }
        try {
            // Make sure at least one engine is installed.
            TextToSpeech probe = new TextToSpeech(getContext(), null);
            List<EngineInfo> engines = probe.getEngines();
            try { probe.shutdown(); } catch (Exception ignored) {}
            if (engines == null || engines.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("status", "engineMissing");
                call.resolve(ret);
                return;
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("status", "engineMissing");
            call.resolve(ret);
            return;
        }

        final TextToSpeech[] ttsHolder = new TextToSpeech[1];
        ttsHolder[0] = new TextToSpeech(getContext(), new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                JSObject ret = new JSObject();
                if (status != TextToSpeech.SUCCESS) {
                    ret.put("status", "engineMissing");
                } else {
                    int avail;
                    try {
                        avail = ttsHolder[0].isLanguageAvailable(locale);
                    } catch (Exception e) {
                        avail = TextToSpeech.LANG_NOT_SUPPORTED;
                    }
                    if (avail == TextToSpeech.LANG_AVAILABLE
                            || avail == TextToSpeech.LANG_COUNTRY_AVAILABLE
                            || avail == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE) {
                        ret.put("status", "installed");
                    } else if (avail == TextToSpeech.LANG_MISSING_DATA) {
                        ret.put("status", "missing");
                    } else {
                        ret.put("status", "missing");
                    }
                }
                try { ttsHolder[0].shutdown(); } catch (Exception ignored) {}
                call.resolve(ret);
            }
        });
    }
}
