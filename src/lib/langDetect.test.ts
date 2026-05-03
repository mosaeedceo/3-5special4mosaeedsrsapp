import { describe, expect, it } from 'vitest';
import { detectLanguage } from './langDetect';

describe('detectLanguage', () => {
  it('returns null for empty / whitespace input', () => {
    expect(detectLanguage('')).toBeNull();
    expect(detectLanguage('   ')).toBeNull();
  });

  it('returns null for ambiguous Latin text', () => {
    expect(detectLanguage('hello world')).toBeNull();
    expect(detectLanguage('the cat sat on the mat')).toBeNull();
  });

  it('detects Arabic script', () => {
    expect(detectLanguage('مرحبا')).toBe('ar-SA');
  });

  it('detects Cyrillic / Russian', () => {
    expect(detectLanguage('Привет')).toBe('ru-RU');
  });

  it('detects Japanese kana', () => {
    expect(detectLanguage('こんにちは')).toBe('ja-JP');
  });

  it('detects Korean Hangul', () => {
    expect(detectLanguage('안녕하세요')).toBe('ko-KR');
  });

  it('detects Chinese Han', () => {
    expect(detectLanguage('你好')).toBe('zh-CN');
  });

  it('detects German via ß', () => {
    expect(detectLanguage('Straße')).toBe('de-DE');
  });

  it('detects German umlaut without French markers', () => {
    expect(detectLanguage('Mädchen')).toBe('de-DE');
    expect(detectLanguage('schön')).toBe('de-DE');
  });

  it('detects Spanish via ñ / ¿', () => {
    expect(detectLanguage('mañana')).toBe('es-ES');
    expect(detectLanguage('¿Cómo estás?')).toBe('es-ES');
  });

  it('detects French via œ / ç / accents', () => {
    expect(detectLanguage('cœur')).toBe('fr-FR');
    expect(detectLanguage('garçon')).toBe('fr-FR');
    expect(detectLanguage('après')).toBe('fr-FR');
  });

  it('strips HTML before detecting', () => {
    expect(detectLanguage('<b>Straße</b>')).toBe('de-DE');
  });
});
