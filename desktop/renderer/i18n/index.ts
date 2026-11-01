import { de } from './de.js';
import { en } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { it } from './it.js';
import { ja } from './ja.js';
import { kk } from './kk.js';
import type { Messages } from './messages.js';
import { ru } from './ru.js';
import { zh } from './zh.js';

export type Locale = 'en' | 'ru' | 'zh-CN' | 'fr' | 'de' | 'it' | 'es' | 'kk' | 'ja';
export const defaultLocale: Locale = 'en';
export const supportedLocales: Locale[] = ['en', 'ru', 'zh-CN', 'fr', 'de', 'it', 'es', 'kk', 'ja'];
export const localeStorageKey = 'interconnect.locale';

export function isLocale(value: unknown): value is Locale {
  return (supportedLocales as readonly unknown[]).includes(value);
}

export function localeLabel(locale: Locale): string {
  return (
    {
      en: 'English',
      ru: 'Русский',
      'zh-CN': '中文（简体）',
      fr: 'Français',
      de: 'Deutsch',
      it: 'Italiano',
      es: 'Español',
      kk: 'Қазақша',
      ja: '日本語',
    } as const
  )[locale];
}

const dictionaries: Record<Locale, Messages> = {
  en,
  ru,
  'zh-CN': zh,
  fr,
  de,
  it,
  es,
  kk,
  ja,
};

const interpolate = (template: string, params: Record<string, string | number>): string =>
  Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );

export function t(
  locale: Locale,
  key: keyof Messages,
  params: Record<string, string | number> = {},
): string {
  const messages = dictionaries[locale] ?? en;
  const template = messages[key] ?? en[key];
  return interpolate(template, params);
}

export function loadLocale(storage: Pick<Storage, 'getItem'>): Locale {
  const value = storage.getItem(localeStorageKey);
  return isLocale(value) ? value : defaultLocale;
}

export function persistLocale(storage: Pick<Storage, 'setItem'>, locale: Locale): void {
  storage.setItem(localeStorageKey, locale);
}
