import test from 'node:test';
import assert from 'node:assert/strict';
import { de } from '../desktop/renderer/i18n/de.js';
import { en } from '../desktop/renderer/i18n/en.js';
import { es } from '../desktop/renderer/i18n/es.js';
import { fr } from '../desktop/renderer/i18n/fr.js';
import { it } from '../desktop/renderer/i18n/it.js';
import { ja } from '../desktop/renderer/i18n/ja.js';
import { kk } from '../desktop/renderer/i18n/kk.js';
import { ko } from '../desktop/renderer/i18n/ko.js';
import type { Messages } from '../desktop/renderer/i18n/messages.js';
import { nl } from '../desktop/renderer/i18n/nl.js';
import { pl } from '../desktop/renderer/i18n/pl.js';
import { ptBR } from '../desktop/renderer/i18n/pt-BR.js';
import { ru } from '../desktop/renderer/i18n/ru.js';
import { tr } from '../desktop/renderer/i18n/tr.js';
import { uk } from '../desktop/renderer/i18n/uk.js';
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
  assert.equal(
    loadLocale(() => memoryStorage()),
    'en',
  );
});

test('locale is loaded and persisted through the app profile storage', () => {
  const storage = memoryStorage();
  persistLocale(() => storage, 'ru');
  assert.equal(
    loadLocale(() => storage),
    'ru',
  );
  persistLocale(() => storage, 'en');
  assert.equal(
    loadLocale(() => storage),
    'en',
  );
});

test('unknown locale falls back to English', () => {
  const storage = memoryStorage({ 'interconnect.locale': 'xx' });
  assert.equal(
    loadLocale(() => storage),
    'en',
  );
  assert.equal(t('xx' as never, 'navOverview'), 'Overview');
});

test('storage getter failure falls back to English', () => {
  assert.equal(
    loadLocale(() => {
      const error = new DOMException('blocked', 'SecurityError');
      assert.throws(() => {
        throw error;
      }, /blocked/);
      throw error;
    }),
    'en',
  );
});

test('getItem failure falls back to English', () => {
  const storage: Pick<Storage, 'getItem'> = {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
  };
  assert.equal(
    loadLocale(() => storage),
    'en',
  );
});

test('setItem failure keeps the locale active in memory', () => {
  const storage: Pick<Storage, 'setItem'> = {
    setItem: () => {
      throw new DOMException('quota', 'QuotaExceededError');
    },
  };
  assert.doesNotThrow(() => persistLocale(() => storage, 'ru'));
});

test('every dictionary covers all interface messages', () => {
  const keys = Object.keys(en as Messages).sort();
  for (const dictionary of [en, ru, zh, fr, de, it, es, kk, ja, ptBR, ko, tr, pl, nl, uk]) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys);
  }
});

test('supported locales are stable and labelled', () => {
  assert.deepEqual(supportedLocales, [
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
  ]);
  assert.equal(localeLabel('en'), 'English');
  assert.equal(localeLabel('ru'), 'Русский');
  assert.equal(localeLabel('zh-CN'), '中文（简体）');
  assert.equal(localeLabel('fr'), 'Français');
  assert.equal(localeLabel('de'), 'Deutsch');
  assert.equal(localeLabel('it'), 'Italiano');
  assert.equal(localeLabel('es'), 'Español');
  assert.equal(localeLabel('kk'), 'Қазақша');
  assert.equal(localeLabel('ja'), '日本語');
  assert.equal(localeLabel('pt-BR'), 'Português (Brasil)');
  assert.equal(localeLabel('ko'), '한국어');
  assert.equal(localeLabel('tr'), 'Türkçe');
  assert.equal(localeLabel('pl'), 'Polski');
  assert.equal(localeLabel('nl'), 'Nederlands');
  assert.equal(localeLabel('uk'), 'Українська');
});

const spotChecks: [Locale, string][] = [
  ['en', 'Settings'],
  ['ru', 'Настройки'],
  ['zh-CN', '设置'],
  ['fr', 'Réglages'],
  ['de', 'Einstellungen'],
  ['it', 'Impostazioni'],
  ['es', 'Ajustes'],
  ['kk', 'Параметрлер'],
  ['ja', '設定'],
  ['pt-BR', 'Configurações'],
  ['ko', '설정'],
  ['tr', 'Ayarlar'],
  ['pl', 'Ustawienia'],
  ['nl', 'Instellingen'],
  ['uk', 'Налаштування'],
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
  assert.equal(t('pt-BR', 'agentMessages', { count: 12 }), 'Mensagens: 12');
  assert.equal(t('pl', 'agentMessages', { count: 12 }), 'Wiadomości: 12');
  assert.equal(t('ko', 'agentMessages', { count: 12 }), '메시지: 12');
  assert.equal(t('zh-CN', 'agentMessages', { count: 12 }), '消息：12');
  assert.equal(t('en', 'directoryUpdated', { time: 'Nov 1, 2026' }), 'Updated Nov 1, 2026');
  assert.equal(t('ru', 'directoryUpdated', { time: '1 нояб. 2026' }), 'Обновлено 1 нояб. 2026');
  assert.equal(t('uk', 'directoryUpdated', { time: '1 листоп. 2026' }), 'Оновлено 1 листоп. 2026');
  assert.equal(t('nl', 'directoryUpdated', { time: '1 nov. 2026' }), 'Gewijzigd op 1 nov. 2026');
  assert.equal(t('fr', 'directoryUpdated', { time: '1 nov. 2026' }), 'Mise à jour : 1 nov. 2026');
});

test('application connection labels identify saved profiles and issue counts in every locale', () => {
  const id = 'saved-connection-42';
  for (const locale of supportedLocales) {
    assert.ok(t(locale, 'clientsSavedConnection', { id }).includes(id));
    assert.ok(!t(locale, 'clientsSavedConnection', { id }).includes('{id}'));
    assert.ok(t(locale, 'clientsConnectionIssues', { count: 7 }).includes('7'));
    assert.ok(!t(locale, 'clientsConnectionIssues', { count: 7 }).includes('{count}'));
    for (const key of [
      'clientsPartiallyConnected',
      'clientsAvailable',
      'clientsUnavailable',
      'clientsChecking',
    ] as const) {
      assert.ok(t(locale, key).length > 0);
      if (locale !== 'en') assert.notEqual(t(locale, key), t('en', key));
    }
  }
  assert.equal(
    t('en', 'clientsSavedConnection', { id }),
    'Saved connection without an agent (saved-connection-42)',
  );
  assert.equal(t('ru', 'clientsConnectionIssues', { count: 7 }), 'Подключения с ошибками: 7');
});

test('connection guidance is localized and preserves uncertain and unsupported distinctions', () => {
  for (const locale of supportedLocales) {
    for (const key of [
      'clientsStatusHelp',
      'clientsUnavailableImpact',
      'clientsUnboundImpact',
      'clientsUseSavedAction',
      'clientsCheckExactChat',
      'clientsUncertainImpact',
      'clientsCheckBeforeRetry',
      'clientsUnsupportedImpact',
      'clientsUnconfirmedImpact',
      'clientsReleased',
      'clientsReleasedImpact',
      'clientsReleasedAction',
      'clientsNotConfirmed',
    ] as const) {
      assert.ok(t(locale, key).length > 0);
      if (locale !== 'en') assert.notEqual(t(locale, key), t('en', key));
    }
    assert.notEqual(t(locale, 'clientsUncertainImpact'), t(locale, 'clientsUnavailableImpact'));
    assert.notEqual(t(locale, 'clientsUnsupportedImpact'), t(locale, 'clientsUnconfirmedImpact'));
    assert.notEqual(t(locale, 'clientsCheckBeforeRetry'), t(locale, 'clientsCheckExactChat'));
    assert.notEqual(t(locale, 'clientsReleased'), t(locale, 'clientsNotConfirmed'));
    assert.notEqual(t(locale, 'clientsReleased'), t(locale, 'clientsPaused'));
  }
  assert.equal(t('ru', 'clientsColumnAction'), 'Что делать');
  assert.equal(t('en', 'clientsNoBoundAgent'), 'No agent attached');
});

test('interpolation preserves dollar-pattern user values literally', () => {
  assert.equal(
    t('en', 'msgAttachmentSize', { name: 'budget$&.txt', size: 1 }),
    'budget$&.txt · 1 KB',
  );
  assert.equal(t('en', 'msgAttachmentSize', { name: 'slot$$.txt', size: 2 }), 'slot$$.txt · 2 KB');
  assert.equal(
    t('en', 'msgAttachmentSize', { name: 'left$`right.txt', size: 3 }),
    'left$`right.txt · 3 KB',
  );
  assert.equal(
    t('en', 'msgAttachmentSize', { name: "mid$'end.txt", size: 4 }),
    "mid$'end.txt · 4 KB",
  );
});

test('interpolation never re-reads substituted user values', () => {
  assert.equal(t('en', 'msgAttachmentSize', { name: '{size}.txt', size: 1 }), '{size}.txt · 1 KB');
  assert.equal(t('en', 'agentListClient', { client: '{client}' }), 'Client: {client}');
  assert.equal(t('en', 'headerPrefix', { node: '{node}' }), 'NODE / {node}');
});

test('every translation uses the same placeholder names as English', () => {
  const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const keyPlaceholders = (dictionary: Messages) => {
    const result: Record<string, string[]> = {};
    for (const key of Object.keys(en as Messages)) {
      result[key] = placeholders(dictionary[key as keyof Messages]).sort();
    }
    return result;
  };
  const english = keyPlaceholders(en);
  const dictionaries = [en, ru, zh, fr, de, it, es, kk, ja, ptBR, ko, tr, pl, nl, uk];
  for (const dictionary of dictionaries) {
    assert.deepEqual(keyPlaceholders(dictionary), english);
  }
});

test('no translation value is empty', () => {
  const dictionaries = [en, ru, zh, fr, de, it, es, kk, ja, ptBR, ko, tr, pl, nl, uk];
  for (const dictionary of dictionaries) {
    for (const key of Object.keys(en as Messages)) {
      assert.ok(String(dictionary[key as keyof Messages]).length > 0, `empty value for ${key}`);
    }
  }
});
