import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ApplicationDiscoverySnapshot } from '../desktop/shared/application-discovery.js';
import type { McpSetupClient } from '../desktop/shared/mcp-setup.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
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

const detected = (...clients: McpSetupClient[]): ApplicationDiscoverySnapshot => ({
  checkedAt: '',
  platform: 'darwin',
  offers: [],
  stateError: false,
  applications: clients.map((client) => ({
    client,
    status: 'detected',
    instances: [],
    coverage: [],
  })),
});

function setupFixture(snapshot?: ApplicationDiscoverySnapshot) {
  const flow = new ApplicationSetupFlow(async () => assert.fail('Rendering cannot invoke setup'));
  return {
    flow,
    states: flow.getSnapshot(),
    discovery: {
      snapshot,
      busy: false,
      failed: false,
      offers: [],
      offerError: false,
      acknowledge: async () => {},
      dismiss() {},
      refresh: async () => {},
      choose: async () => {},
    },
    statuses: {
      statuses: {
        codex: { client: 'codex', remembered: false, state: 'missing', files: [] },
        opencode: { client: 'opencode', remembered: false, state: 'missing', files: [] },
      } as const,
      errors: {},
      refreshAll: async () => {},
    },
    locale: 'en',
  } satisfies Omit<React.ComponentProps<typeof OverviewApplications>, 'snapshot'>;
}

test('Overview hides an empty application section and saved profiles without a connected chat', () => {
  const snapshot = { adapters: [profile('saved', 'cursor-hook')], agents: [] };
  assert.deepEqual(connectedOverviewApplications(snapshot), []);
  assert.equal(
    renderToStaticMarkup(
      React.createElement(OverviewApplications, {
        snapshot,
        ...setupFixture(),
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
    ['opencode-v2', 'opencode'],
  );
  const html = renderToStaticMarkup(
    React.createElement(OverviewApplications, {
      snapshot,
      ...setupFixture(detected('opencode')),
    }),
  );
  assert.equal((html.match(/data-testid="overview-application-/g) ?? []).length, 2);
  assert.ok(html.includes('OpenCode v1'));
  assert.ok(html.includes('OpenCode v2'));
  assert.ok(html.includes('Inbox: 2'));
  assert.ok(html.includes('Inbox: 3'));
  assert.ok(!html.includes('<button'));
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
      ...setupFixture(detected('cursor')),
    }),
  );
  assert.ok(html.includes('Inbox: 3'));
  assert.ok(!html.includes('Private diagnostic'));
});

test('Overview lists detected apps, highlights live connections, and offers setup for the rest', () => {
  const discovery = detected('cursor', 'codex', 'opencode');
  discovery.applications.push({
    client: 'claude',
    status: 'not-found-in-known-locations',
    instances: [],
    coverage: [],
  });
  const html = renderToStaticMarkup(
    React.createElement(OverviewApplications, {
      snapshot: {
        adapters: [profile('cursor', 'cursor-hook'), profile('claude', 'claude-code')],
        agents: [agent('Cursor', 'cursor', 4), agent('Claude', 'claude')],
      },
      ...setupFixture(discovery),
    }),
  );
  assert.ok(html.includes('You can start working'));
  assert.ok(html.includes('overview-application-cursor" data-connected="true"'));
  assert.ok(html.includes('Inbox: 4'));
  assert.ok(html.includes('Configured'));
  assert.ok(html.includes('Already set up. You can work in this app now.'));
  assert.ok(html.includes('Detected on this computer'));
  assert.ok(html.includes('Connect — ChatGPT'));
  assert.ok(html.includes('Connect — OpenCode v1'));
  assert.ok(!html.includes('overview-application-opencode-v2"'));
  assert.ok(html.includes('overview-application-claude" data-connected="true"'));
});

test('Overview retains a live ChatGPT card when installation discovery is unavailable or missing', () => {
  const snapshot = {
    adapters: [profile('codex', 'codex-desktop')],
    agents: [agent('луна', 'codex', 2)],
  };
  for (const discovery of [undefined, detected('cursor')]) {
    const html = renderToStaticMarkup(
      React.createElement(OverviewApplications, {
        snapshot,
        ...setupFixture(discovery),
      }),
    );
    assert.ok(html.includes('overview-application-codex" data-connected="true"'));
    assert.ok(html.includes('Inbox: 2'));
    assert.ok(!html.includes('Connect — ChatGPT'));
    assert.ok(!html.includes('Connect — Codex'));
    const card = html.slice(html.indexOf('data-testid="overview-application-codex"'));
    assert.ok(!card.includes('Detected on this computer'));
  }
});

test('Overview shows the saved v2 next step without treating it as a live connection', () => {
  const setup = setupFixture(detected('opencode'));
  const target = {
    major: 2,
    installationId: 'fixture-v2',
    installationPath: '/fixture/opencode-v2',
    profilePath: '/fixture/profile',
    configurationPath: '/fixture/profile/opencode.json',
  } as const;
  const html = renderToStaticMarkup(
    React.createElement(OverviewApplications, {
      snapshot: { adapters: [], agents: [] },
      ...setup,
      states: {
        ...setup.states,
        'opencode-v2': { ...setup.states['opencode-v2'], target, phase: 'succeeded' },
      },
    }),
  );
  assert.ok(html.includes('Configured'));
  assert.ok(html.includes('Restart OpenCode v2'));
  const guidanceIndex = html.indexOf('data-testid="overview-chat-guidance"');
  const gridIndex = html.indexOf('data-testid="overview-applications-grid"');
  assert.ok(guidanceIndex >= 0 && guidanceIndex < gridIndex);
  const command = 'Connect as agent &lt;a name you choose&gt;';
  const guidance = html.slice(guidanceIndex, gridIndex);
  assert.ok(
    guidance.includes('In your app, open a new chat or return to an existing one, then type '),
  );
  assert.ok(guidance.includes(command));
  assert.ok(!html.slice(gridIndex).includes(command));
  assert.ok(!html.includes('Connect — OpenCode v2'));
  assert.ok(!html.includes('Copy prompt'));
  assert.ok(!html.includes('data-connected="true"'));
});

test('Overview widens ChatGPT only when it displays a compatibility warning', () => {
  const snapshot = {
    adapters: [profile('chatgpt', 'codex-desktop')],
    agents: [agent('Connected', 'chatgpt')],
  };
  for (const [version, warning] of [
    ['26.1111.71704', false],
    ['26.1117.41037', true],
  ] as const) {
    const discovery = {
      ...detected('codex'),
      chatgptCompatibility: { status: 'affected' as const, version },
    };
    const html = renderToStaticMarkup(
      React.createElement(OverviewApplications, {
        snapshot,
        ...setupFixture(discovery),
      }),
    );
    assert.equal(/<div[^>]*data-compatibility-warning="true"/.test(html), warning);
    if (warning) {
      const notice = html.indexOf('role="alert"');
      assert.ok(
        notice > 0 && notice < html.indexOf('Already set up. You can work in this app now.'),
      );
    }
  }
});
