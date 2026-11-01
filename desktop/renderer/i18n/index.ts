import { en } from './en.js';
import type { Messages } from './messages.js';
import { ru } from './ru.js';

export type Locale = 'en' | 'ru';
export const defaultLocale: Locale = 'en';
export const supportedLocales: Locale[] = ['en', 'ru'];
export const localeStorageKey = 'interconnect.locale';

export function isLocale(value: unknown): value is Locale {
  return (supportedLocales as readonly unknown[]).includes(value);
}

export function localeLabel(locale: Locale): string {
  return locale === 'ru' ? 'Русский' : 'English';
}

const dictionaries: Record<Locale, Messages> = { en, ru };

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
