import test from 'node:test';
import assert from 'node:assert/strict';
import { de } from '../desktop/renderer/i18n/de.js';
import { en } from '../desktop/renderer/i18n/en.js';
import { es } from '../desktop/renderer/i18n/es.js';
import { fr } from '../desktop/renderer/i18n/fr.js';
import { it } from '../desktop/renderer/i18n/it.js';
import { ja } from '../desktop/renderer/i18n/ja.js';
import { kk } from '../desktop/renderer/i18n/kk.js';
import type { Messages } from '../desktop/renderer/i18n/messages.js';
import { ru } from '../desktop/renderer/i18n/ru.js';
import { zh } from '../desktop/renderer/i18n/zh.js';
import {
  defaultLocale,
  loadLocale,
  localeLabel,
  persistLocale,
  supportedLocales,
  t,
  type Locale,
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
  const storage = memoryStorage({ 'interconnect.locale': 'xx' });
  assert.equal(loadLocale(storage), 'en');
  assert.equal(t('xx' as never, 'navOverview'), 'Overview');
});

test('every dictionary covers all interface messages', () => {
  const keys = Object.keys(en as Messages).sort();
  for (const dictionary of [en, ru, zh, fr, de, it, es, kk, ja]) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys);
  }
});

test('supported locales are stable and labelled', () => {
  assert.deepEqual(supportedLocales, ['en', 'ru', 'zh', 'fr', 'de', 'it', 'es', 'kk', 'ja']);
  assert.equal(localeLabel('en'), 'English');
  assert.equal(localeLabel('ru'), 'Русский');
  assert.equal(localeLabel('zh'), '中文');
  assert.equal(localeLabel('fr'), 'Français');
  assert.equal(localeLabel('de'), 'Deutsch');
  assert.equal(localeLabel('it'), 'Italiano');
  assert.equal(localeLabel('es'), 'Español');
  assert.equal(localeLabel('kk'), 'Қазақша');
  assert.equal(localeLabel('ja'), '日本語');
});

const spotChecks: [Locale, string][] = [
  ['en', 'Settings'],
  ['ru', 'Настройки'],
  ['zh', '设置'],
  ['fr', 'Réglages'],
  ['de', 'Einstellungen'],
  ['it', 'Impostazioni'],
  ['es', 'Ajustes'],
  ['kk', 'Параметрлер'],
  ['ja', '設定'],
];

test('languages do not fall back silently for key interface strings', () => {
  for (const [locale, expected] of spotChecks) {
    assert.equal(t(locale, 'navSettings'), expected);
    if (locale !== 'en') assert.notEqual(t(locale, 'navSettings'), t('en', 'navSettings'));
  }
});

test('interpolation substitutes parameters', () => {
  assert.equal(t('en', 'agentMessages', { count: 12 }), 'Messages: 12');
  assert.equal(t('ru', 'agentMessages', { count: 12 }), 'Сообщений: 12');
  assert.equal(t('de', 'agentMessages', { count: 12 }), 'Nachrichten: 12');
  assert.equal(t('zh', 'agentMessages', { count: 12 }), '消息：12');
  assert.equal(t('en', 'directoryUpdated', { time: 'Nov 1, 2026' }), 'Updated Nov 1, 2026');
  assert.equal(t('ru', 'directoryUpdated', { time: '1 нояб. 2026' }), 'Обновлено 1 нояб. 2026');
  assert.equal(t('fr', 'directoryUpdated', { time: '1 nov. 2026' }), 'Mise à jour : 1 nov. 2026');
});
