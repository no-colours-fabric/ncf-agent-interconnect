import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ApplicationConnections,
  ClientApplicationMetrics,
  applicationActivity,
} from '../desktop/renderer/application-connections.js';
import type { AdapterState, AgentIdentity } from '../desktop/shared/contracts.js';
import { t } from '../desktop/renderer/i18n/index.js';

const profile = (id: string): AdapterState => ({
  id,
  label: 'Private connection',
  kind: 'codex-desktop',
  state: 'uncertain',
  error: 'Private diagnostic',
  capabilities: { wakeIdle: false, receiveActive: false, nativeDisplay: false, exactSession: true },
});
const agent = (nickname: string, adapterId: string): AgentIdentity => ({
  key: nickname.toLowerCase(),
  nickname,
  binding: { adapterId, client: 'Example', connectionId: nickname, chatId: 'exact', generation: 1 },
  messageCount: 0,
  unread: 0,
});

test('applications show one row per application, total agents and no agent or connection listings', () => {
  const snapshot = {
    adapters: [profile('first'), profile('second')],
    agents: [agent('Альфа 漢字', 'first'), agent('Другой', 'second')],
  };
  const html = renderToStaticMarkup(
    createElement(ApplicationConnections, {
      snapshot,
      locale: 'ru',
      onSetup: () => assert.fail('render must not trigger setup'),
    }),
  );
  assert.equal((html.match(/data-testid="application-/g) ?? []).length, 6);
  assert.ok(html.includes('data-testid="application-claude-code"'));
  assert.ok(html.includes(t('ru', 'clientsKindClaude')));
  assert.ok(html.includes(t('ru', 'clientsLastActivity')));
  assert.ok(html.includes(t('ru', 'clientsKindCodex')));
  assert.ok(html.includes('>2</td>'));
  for (const value of [
    'Альфа 漢字',
    'Другой',
    'Private connection',
    'Private diagnostic',
    '<details',
    t('ru', 'clientsColumnStatus'),
    t('ru', 'clientsNeedsReview'),
  ])
    assert.ok(!html.includes(value), value);
  assert.equal((html.match(/<button/g) ?? []).length, 6);
});

test('last activity is the latest observed message or exact-chat verification, including failed profiles', () => {
  const first = profile('first');
  first.lastOwnerVerifiedAt = '2026-11-01T10:00:00.000Z';
  const owner = { ...agent('Owner', 'first'), lastMessageAt: '2026-11-01T11:00:00.000Z' };
  const snapshot = { adapters: [first], agents: [owner] };
  assert.equal(applicationActivity('codex-desktop', snapshot), owner.lastMessageAt);
  first.lastOwnerVerifiedAt = '2026-11-01T12:00:00.000Z';
  assert.equal(applicationActivity('codex-desktop', snapshot), first.lastOwnerVerifiedAt);
  const html = renderToStaticMarkup(
    createElement(ApplicationConnections, { snapshot, locale: 'en', onSetup: () => {} }),
  );
  assert.ok(html.includes(new Date(first.lastOwnerVerifiedAt).toLocaleString('en')));
  assert.ok(!html.includes(t('en', 'clientsConnected')));
});

test('missing activity stays unknown and unrelated or invalid observations cannot fabricate it', () => {
  const first = profile('first');
  first.lastOwnerVerifiedAt = 'invalid';
  const snapshot = {
    adapters: [first],
    agents: [{ ...agent('Other', 'other'), lastMessageAt: '2026-11-01T13:00:00.000Z' }],
  };
  assert.equal(applicationActivity('codex-desktop', snapshot), null);
  assert.equal(applicationActivity('manual', snapshot), null);
});

test('Cursor recovery is shown as paused instead of connected', () => {
  const recovering: AdapterState = {
    ...profile('cursor-recovery'),
    kind: 'cursor-hook',
    state: 'recovering',
    error: null,
  };
  const snapshot = {
    adapters: [recovering],
    agents: [agent('Cursor agent', recovering.id)],
  };
  const html = renderToStaticMarkup(
    createElement(ClientApplicationMetrics, {
      kind: 'cursor-hook',
      snapshot,
      locale: 'en',
      unknownLabel: 'Unknown',
      deliveryLabel: 'Delivery',
    }),
  );
  assert.ok(html.includes(t('en', 'clientsPaused')));
  assert.ok(!html.includes(t('en', 'clientsConnected')));
});
