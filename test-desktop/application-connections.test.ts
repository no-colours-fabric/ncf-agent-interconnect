import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationConnections } from '../desktop/renderer/application-connections.js';
import type { AdapterState, AgentIdentity } from '../desktop/shared/contracts.js';
import { t } from '../desktop/renderer/i18n/index.js';

function profile(id: string, error: string | null): AdapterState {
  return {
    id,
    label: 'Example connection',
    kind: 'codex-desktop',
    state: error ? 'error' : 'ready',
    error,
    capabilities: {
      wakeIdle: !error,
      receiveActive: !error,
      nativeDisplay: false,
      exactSession: !error,
    },
  };
}

function agent(nickname: string, adapterId: string): AgentIdentity {
  return {
    key: nickname.toLowerCase(),
    nickname,
    binding: {
      adapterId,
      client: 'Example',
      connectionId: nickname,
      chatId: 'exact',
      generation: 1,
    },
    messageCount: 0,
    unread: 0,
  };
}

function render(adapters: AdapterState[], agents: AgentIdentity[] = []) {
  return renderToStaticMarkup(
    createElement(ApplicationConnections, {
      snapshot: { adapters, agents },
      locale: 'ru',
      onSetup: () => {
        assert.fail('rendering must not initiate an external action');
      },
    }),
  );
}

const rowsWithDetails = (html: string) =>
  [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)]
    .map((match) => match[0])
    .filter((row) => row.includes('<details'));

test('one connection row groups its agents and retains the correct diagnostic association', () => {
  const html = render(
    [
      profile('first-connection', 'first diagnostic'),
      profile('second-connection', 'second diagnostic'),
    ],
    [
      agent('Альфа 漢字', 'first-connection'),
      agent('İsim', 'first-connection'),
      agent('Другой', 'second-connection'),
    ],
  );
  const rows = rowsWithDetails(html);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].includes('Альфа 漢字') && rows[0].includes('İsim'));
  assert.ok(rows[0].includes('first diagnostic'));
  assert.ok(!rows[0].includes('second diagnostic'));
  assert.ok(rows[1].includes('Другой') && rows[1].includes('second diagnostic'));
  assert.ok(!rows[1].includes('first diagnostic'));
  assert.ok(html.includes('scope="row"'));
  assert.ok(html.includes(t('ru', 'clientsColumnAction')));
});

test('technical identifiers and messages stay in closed accessible details and are escaped', () => {
  const id = 'connection-technical-marker',
    error = '<script>invalid()</script>& diagnostic',
    html = render([profile(id, error)], [agent('Проверка <&>', id)]),
    details = [...html.matchAll(/<details\b[\s\S]*?<\/details>/g)].map((match) => match[0]),
    visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
  assert.equal(details.length, 1);
  assert.ok(details[0].includes(id));
  assert.ok(details[0].includes('&lt;script&gt;invalid()&lt;/script&gt;&amp; diagnostic'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!visible.includes(id));
  assert.ok(!visible.includes('diagnostic'));
  assert.ok(!/<details\b[^>]*\bopen(?:\s|=|>)/.test(details[0]));
  assert.ok(details[0].includes('<summary'));
  assert.ok(details[0].includes('aria-label='));
  assert.ok(html.includes('Проверка &lt;&amp;&gt;'));
});

test('an unavailable saved connection remains visible without a global red alert', () => {
  const html = render([profile('unused-connection', 'fetch failed')]),
    visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
  assert.equal(rowsWithDetails(html).length, 1);
  assert.ok(visible.includes(t('ru', 'clientsNoBoundAgent')));
  assert.ok(visible.includes(t('ru', 'clientsUnboundImpact')));
  assert.ok(visible.includes(t('ru', 'clientsUseSavedAction')));
  assert.ok(!visible.includes('unused-connection'));
  assert.ok(!visible.includes('fetch failed'));
  assert.ok(!html.includes('role="alert"'));
});

test('uncertain admission is explained separately and does not expose a resend action', () => {
  const connection = {
      ...profile('uncertain', 'Codex IPC: request timed out'),
      state: 'uncertain' as const,
    },
    html = render([connection], [agent('Проверка', connection.id)]),
    visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
  assert.ok(visible.includes(t('ru', 'clientsUncertainImpact')));
  assert.ok(visible.includes(t('ru', 'clientsCheckBeforeRetry')));
  const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every((button) => button.includes(t('ru', 'clientsCta'))));
});
