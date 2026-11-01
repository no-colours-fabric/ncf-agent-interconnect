import { de } from './de.js';
import { en } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { it } from './it.js';
import { ja } from './ja.js';
import { kk } from './kk.js';
import { ko } from './ko.js';
import type { Messages } from './messages.js';
import { nl } from './nl.js';
import { pl } from './pl.js';
import { ptBR } from './pt-BR.js';
import { ru } from './ru.js';
import { tr } from './tr.js';
import { uk } from './uk.js';
import { zh } from './zh.js';

export type Locale =
  | 'en'
  | 'ru'
  | 'zh-CN'
  | 'fr'
  | 'de'
  | 'it'
  | 'es'
  | 'kk'
  | 'ja'
  | 'pt-BR'
  | 'ko'
  | 'tr'
  | 'pl'
  | 'nl'
  | 'uk';
export const defaultLocale: Locale = 'en';
export const supportedLocales: Locale[] = [
  'en',
  'ru',
  'zh-CN',
  'fr',
  'de',
  'it',
  'es',
  'kk',
  'ja',
  'pt-BR',
  'ko',
  'tr',
  'pl',
  'nl',
  'uk',
];
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
      'pt-BR': 'Português (Brasil)',
      ko: '한국어',
      tr: 'Türkçe',
      pl: 'Polski',
      nl: 'Nederlands',
      uk: 'Українська',
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
  'pt-BR': ptBR,
  ko,
  tr,
  pl,
  nl,
  uk,
};

const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
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

export function loadLocale(getStorage: () => Pick<Storage, 'getItem'> | null | undefined): Locale {
  try {
    const value = getStorage()?.getItem(localeStorageKey);
    return isLocale(value) ? value : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export function persistLocale(
  getStorage: () => Pick<Storage, 'setItem'> | null | undefined,
  locale: Locale,
): void {
  try {
    getStorage()?.setItem(localeStorageKey, locale);
  } catch {
    // Storage write failed; the new locale stays active in memory.
  }
}
