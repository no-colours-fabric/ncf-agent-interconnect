import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../desktop/renderer/i18n/en.js';
import { ru } from '../desktop/renderer/i18n/ru.js';
import type { Messages } from '../desktop/renderer/i18n/messages.js';
import {
  defaultLocale,
  loadLocale,
  localeLabel,
  persistLocale,
  supportedLocales,
  t,
} from '../desktop/renderer/i18n/index.js';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
};

test('default locale is English', () => {
  assert.equal(defaultLocale, 'en');
  assert.equal(loadLocale(memoryStorage()), 'en');
});

test('locale is loaded and persisted through the app profile storage', () => {
  const storage = memoryStorage();
  persistLocale(storage, 'ru');
  assert.equal(loadLocale(storage), 'ru');
  persistLocale(storage, 'en');
  assert.equal(loadLocale(storage), 'en');
});

test('unknown locale falls back to English', () => {
  const storage = memoryStorage({ 'interconnect.locale': 'de' });
  assert.equal(loadLocale(storage), 'en');
  assert.equal(t('de' as never, 'navOverview'), 'Overview');
});

test('every dictionary covers all interface messages', () => {
  const keys = Object.keys(en as Messages).sort();
  for (const dictionary of [en, ru]) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys);
  }
});

test('supported locales are stable and labelled', () => {
  assert.deepEqual(supportedLocales, ['en', 'ru']);
  assert.equal(localeLabel('en'), 'English');
  assert.equal(localeLabel('ru'), 'Русский');
});

test('translations return the expected strings for each locale', () => {
  assert.equal(t('en', 'navSettings'), 'Settings');
  assert.equal(t('ru', 'navSettings'), 'Настройки');
  assert.equal(t('en', 'localeTitle'), 'Interface language');
  assert.equal(t('ru', 'localeTitle'), 'Язык интерфейса');
  assert.equal(t('en', 'copied'), 'Copied');
  assert.equal(t('ru', 'copied'), 'Скопировано');
});

test('interpolation substitutes parameters', () => {
  assert.equal(t('en', 'agentMessages', { count: 12 }), 'Messages: 12');
  assert.equal(t('ru', 'agentMessages', { count: 12 }), 'Сообщений: 12');
  assert.equal(t('en', 'directoryUpdated', { time: 'Nov 1, 2026' }), 'Updated Nov 1, 2026');
  assert.equal(t('ru', 'directoryUpdated', { time: '1 нояб. 2026' }), 'Обновлено 1 нояб. 2026');
});
