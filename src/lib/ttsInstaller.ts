import { registerPlugin } from '@capacitor/core';
import { getPlatform, isNativePlatform } from './platform';

export type TtsLanguageStatus = 'installed' | 'missing' | 'engineMissing';

export interface TtsInstallerPlugin {
  openInstallTtsData(options: { language: string }): Promise<void>;
  openTtsSettings(): Promise<void>;
  checkLanguage(options: { language: string }): Promise<{ status: TtsLanguageStatus }>;
}

const webShim: TtsInstallerPlugin = {
  async openInstallTtsData() {
    throw new Error('TTS install is only available on Android.');
  },
  async openTtsSettings() {
    throw new Error('TTS settings are only available on Android.');
  },
  async checkLanguage() {
    return { status: 'engineMissing' };
  },
};

const TtsInstaller = registerPlugin<TtsInstallerPlugin>('TtsInstaller', {
  web: webShim,
});

/** True only on native Android (the only platform with a system TTS install intent). */
export const isInstallSupported = (): boolean => {
  return isNativePlatform() && getPlatform() === 'android';
};

export const openInstallTtsData = async (language: string): Promise<void> => {
  await TtsInstaller.openInstallTtsData({ language });
};

export const openTtsSettings = async (): Promise<void> => {
  await TtsInstaller.openTtsSettings();
};

export const checkLanguageStatus = async (language: string): Promise<TtsLanguageStatus> => {
  if (!isInstallSupported()) return 'engineMissing';
  try {
    const res = await TtsInstaller.checkLanguage({ language });
    return res.status;
  } catch {
    return 'engineMissing';
  }
};
