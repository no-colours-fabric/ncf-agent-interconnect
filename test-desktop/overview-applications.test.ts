import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdapterState, AgentIdentity } from '../desktop/shared/contracts.js';
import {
  OverviewApplications,
  connectedOverviewApplications,
} from '../desktop/renderer/OverviewApplications.js';

function profile(
  id: string,
  kind: AdapterState['kind'],
  extra: Partial<AdapterState> = {},
): AdapterState {
  return {
    id,
    kind,
    label: id,
    state: 'ready',
    error: null,
    capabilities: { wakeIdle: true, receiveActive: true, nativeDisplay: true, exactSession: true },
    ...extra,
  };
}

function agent(nickname: string, adapterId: string, unread = 0): AgentIdentity {
  return {
    key: nickname.toLowerCase(),
    nickname,
    unread,
    messageCount: unread,
    binding: {
      adapterId,
      chatId: nickname,
      client: 'Fixture',
      connectionId: 'fixture',
      generation: 1,
    },
  };
}

test('Overview hides an empty application section and saved profiles without a connected chat', () => {
  const snapshot = { adapters: [profile('saved', 'cursor-hook')], agents: [] };
  assert.deepEqual(connectedOverviewApplications(snapshot), []);
  assert.equal(
    renderToStaticMarkup(
      React.createElement(OverviewApplications, {
        snapshot,
        locale: 'en',
        onOpen() {
          assert.fail('Rendering cannot navigate');
        },
      }),
    ),
    '',
  );
});

test('Overview includes only current ready bindings, excluding released, failed and unrelated chats', () => {
  const snapshot = {
    adapters: [
      profile('live', 'cursor-hook'),
      profile('released', 'opencode-http', { released: true }),
      profile('failed', 'opencode-v2', { error: 'Private diagnostic' }),
      profile('checking', 'claude-code', { state: 'checking' }),
      profile('unbound', 'aionui'),
    ],
    agents: [
      agent('Live', 'live'),
      agent('Old', 'released'),
      agent('Failed', 'failed'),
      agent('Checking', 'checking'),
      agent('Unrelated', 'missing'),
    ],
  };
  assert.deepEqual(
    connectedOverviewApplications(snapshot).map(({ client }) => client),
    ['cursor'],
  );
});

test('Overview keeps connected OpenCode v1 and v2 separate, with no setup actions or detection claims', () => {
  const snapshot = {
    adapters: [profile('one', 'opencode-http'), profile('two', 'opencode-v2')],
    agents: [agent('Версия один', 'one', 2), agent('Version two', 'two', 3)],
  };
  assert.deepEqual(
    connectedOverviewApplications(snapshot).map(({ client }) => client),
    ['opencode', 'opencode-v2'],
  );
  const html = renderToStaticMarkup(
    React.createElement(OverviewApplications, {
      snapshot,
      locale: 'en',
      onOpen() {
        assert.fail('Rendering cannot navigate');
      },
    }),
  );
  assert.equal((html.match(/data-testid="overview-application-/g) ?? []).length, 2);
  assert.ok(html.includes('OpenCode v1'));
  assert.ok(html.includes('OpenCode v2'));
  assert.ok(html.includes('Inbox: 2'));
  assert.ok(html.includes('Inbox: 3'));
  for (const text of [
    'Manual setup',
    'Connect</',
    'Apply</',
    'Detected on this computer',
    'Private diagnostic',
  ])
    assert.ok(!html.includes(text), text);
});

test('Overview indicators retain partial delivery and issues without exposing diagnostics', () => {
  const snapshot = {
    adapters: [
      profile('ready', 'cursor-hook'),
      profile('failed', 'cursor-hook', { state: 'error', error: 'Private diagnostic' }),
    ],
    agents: [agent('Ready', 'ready', 1), agent('Paused', 'failed', 2)],
  };
  const [application] = connectedOverviewApplications(snapshot);
  assert.equal(application.summary, 'partial');
  assert.equal(application.agents.length, 2);
  assert.equal(application.issues.length, 1);
  const html = renderToStaticMarkup(
    React.createElement(OverviewApplications, {
      snapshot,
      locale: 'en',
      onOpen() {},
    }),
  );
  assert.ok(html.includes('Inbox: 3'));
  assert.ok(!html.includes('Private diagnostic'));
});
