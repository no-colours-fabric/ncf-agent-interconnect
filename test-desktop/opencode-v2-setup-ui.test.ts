import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpenCodeV2SetupFlow } from '../desktop/renderer/opencode-v2-setup-model.js';
import { OpenCodeV2SetupDialog, OpenCodeSetupDialog } from '../desktop/renderer/McpSetup.js';
import { McpSetupFlow } from '../desktop/renderer/mcp-setup-model.js';
import { ApplicationDiscovery } from '../desktop/renderer/ApplicationDiscovery.js';
import type { ApplicationDiscoveryModel } from '../desktop/renderer/useApplicationDiscovery.js';
import { discoveryMessages } from '../desktop/renderer/i18n/application-discovery.js';
import {
  ApplicationRows,
  OpenCodePermissionPreview,
} from '../desktop/renderer/ApplicationSetup.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import { hasConnectedClientChat } from '../desktop/renderer/ClientSetupHelp.js';
import type { Snapshot } from '../desktop/shared/contracts.js';
import { applicationSetupMessages } from '../desktop/renderer/i18n/application-setup.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import { supportedLocales, type Locale } from '../desktop/renderer/i18n/index.js';
import { openCodeRuntimeText } from '../desktop/renderer/i18n/opencode-runtime.js';
import type { OpenCodeV2SetupStatus } from '../desktop/shared/mcp-setup.js';
import type { McpSetupInvoke, OpenCodeV2SetupTarget } from '../desktop/shared/mcp-setup.js';

test('automatic OpenCode confirmation lists only new exact permissions for the selected major', () => {
  for (const client of ['opencode', 'opencode-v2'] as const) {
    const field = client === 'opencode' ? 'permission' : 'permissions';
    const names = ['agent_send', 'agent_read', 'agent_history'].map(
      (tool) => 'ncf_agent_interconnect_' + tool,
    );
    const markup = renderToStaticMarkup(
      React.createElement(OpenCodePermissionPreview, {
        client,
        locale: 'ru',
        file: {
          id: 'configuration',
          path: '/isolated/opencode.json',
          action: 'update',
          changes: [
            { scope: field + '.' + names[0], action: 'add' },
            { scope: field + '.' + names[1], action: 'unchanged' },
            { scope: 'other.' + names[2], action: 'add' },
          ],
        },
      }),
    );
    assert.ok(markup.includes('Разрешить штатные команды NCF'));
    assert.ok(markup.includes(names[0]));
    assert.ok(!markup.includes(names[1]));
    assert.ok(!markup.includes(names[2]));
  }
});

const target: OpenCodeV2SetupTarget = {
  major: 2,
  installationId: null,
  installationPath: null,
  profilePath: '/isolated/Профиль v2',
  configurationPath: '/isolated/Профиль v2/opencode.json',
};
const escape = (text: string) =>
  renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7);
function fixture() {
  let sequence = 0,
    writes = 0,
    changed = false;
  const invoke = (async (method: string, params: { target?: OpenCodeV2SetupTarget } = {}) => {
    if (method === 'opencodeV2SetupDefaults')
      return {
        client: 'opencode-v2',
        target,
        alternatives: [target.configurationPath],
        setupAvailability: { state: 'available' },
      };
    if (method === 'opencodeV2SetupStatus')
      return {
        client: 'opencode-v2',
        target: params.target,
        state: 'not-configured',
        remembered: false,
        setupAvailability: { state: 'available' },
        files: [],
      };
    if (method === 'opencodeV2SetupPreview')
      return {
        client: 'opencode-v2',
        target: params.target,
        targetId: 'fixture-target',
        planId: 'fixture-plan-' + ++sequence,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        requiresReplacement: false,
        files: [
          {
            id: 'configuration',
            path: params.target!.configurationPath,
            action: changed ? 'update' : 'create',
            changes: [{ scope: 'permissions.ncf_agent_interconnect_agent_send', action: 'add' }],
          },
        ],
      };
    if (method === 'opencodeV2SetupApply') {
      writes++;
      throw new Error('Isolated original result unknown');
    }
    if (method === 'opencodeV2SetupDiscard') return { discarded: true };
    throw new Error('Unexpected operation in source UI fixture: ' + method);
  }) as McpSetupInvoke;
  return {
    invoke,
    writes: () => writes,
    change: () => {
      changed = true;
    },
  };
}
function render(flow: OpenCodeV2SetupFlow, locale: Locale = 'en') {
  return renderToStaticMarkup(
    React.createElement(OpenCodeV2SetupDialog, {
      flow,
      locale,
      messages: mcpSetupMessages(locale),
    }),
  );
}

test('v2 manual UI shows the configuration path without setup details; v1 keeps a separate form and draft', async () => {
  const f = fixture(),
    flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.beginManual();
  flow.setConfigurationPath('/isolated/Custom v2/草稿.json');
  await flow.review();
  const html = render(flow, 'ru');
  assert.ok(html.includes('id="mcp-setup-form-opencode-v2"'));
  assert.ok(html.includes('OpenCode v2'));
  assert.ok(html.includes(escape('/isolated/Custom v2/草稿.json')));
  assert.equal(flow.getSnapshot().target?.profilePath, target.profilePath);
  assert.ok(!html.includes(escape(target.profilePath)));
  assert.doesNotMatch(html, /<details\b/);
  assert.ok(!html.includes(escape(applicationSetupMessages('ru').openCodeV2Description)));
  assert.match(html, /role="combobox"/);
  assert.doesNotMatch(html, /<select|Profile [12]/);
  const legacy = new McpSetupFlow('opencode', (async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'opencode',
        files: [
          {
            id: 'configuration',
            path: '/isolated/Legacy v1.json',
            format: 'jsonc',
            alternatives: [],
          },
        ],
      };
    if (method === 'mcpSetupPreview')
      return {
        client: 'opencode',
        planId: 'v1',
        files: [
          {
            id: 'configuration',
            path: '/isolated/Legacy v1.json',
            action: 'create',
            changes: [{ scope: 'permission.ncf_agent_interconnect_agent_send', action: 'add' }],
          },
        ],
        requiresReplacement: false,
      };
    return {};
  }) as McpSetupInvoke);
  await legacy.begin();
  const legacyHtml = renderToStaticMarkup(
    React.createElement(OpenCodeSetupDialog, {
      flow: legacy,
      invoke: f.invoke,
      locale: 'ru',
      messages: mcpSetupMessages('ru'),
      inline: true,
    }),
  );
  assert.ok(legacyHtml.includes('OpenCode v1'));
  assert.ok(legacyHtml.includes('/isolated/Legacy v1.json'));
  assert.ok(!legacyHtml.includes('草稿.json'));
  assert.ok(!html.includes('Legacy v1.json'));
  const messages = mcpSetupMessages('ru');
  for (const manual of [legacyHtml, html]) {
    assert.ok(manual.includes(escape(messages.create)));
    assert.doesNotMatch(manual, /ncf_agent_interconnect_/);
    for (const label of [messages.pathLabel, messages.browse, messages.openFile])
      assert.ok(manual.includes('aria-label="' + escape(label) + '"'));
    assert.ok(manual.includes('>' + escape(messages.apply) + '<'));
  }
  assert.equal(f.writes(), 0);
});

test('v2 UI checks only the active original uncertainty; renewed preview shows Apply and separate confirmation', async () => {
  const f = fixture(),
    flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.beginManual();
  await flow.apply();
  const copy = applicationSetupMessages('en');
  const original = flow.getSnapshot().uncertain;
  const current = render(flow);
  assert.doesNotMatch(current, /<details\b/);
  assert.ok(current.includes(copy.uncertain));
  assert.ok(current.includes(copy.checkSetupResult));
  f.change();
  await flow.checkResult();
  const renewed = render(flow);
  assert.doesNotMatch(renewed, /<details\b/);
  assert.ok(!renewed.includes(copy.checkSetupResult));
  assert.ok(renewed.includes('>Apply<'));
  assert.ok(renewed.includes('type="checkbox"'));
  assert.ok(renewed.includes(copy.reviewHelp));
  assert.ok(renewed.includes('Isolated original result unknown'));
  assert.equal(flow.getSnapshot().uncertain, original);
  assert.equal(f.writes(), 1);
});

test('v2 manual captions, help and target accessibility are professional complete dictionaries in all 15 locales', async () => {
  const keys = [
    'openCodeV1Description',
    'openCodeV2Description',
    'openCodeV2Next',
    'showOpenCodeV1',
  ] as const;
  const english = applicationSetupMessages('en');
  const f = fixture(),
    flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.beginManual();
  for (const locale of supportedLocales) {
    const copy = applicationSetupMessages(locale),
      html = render(flow, locale);
    for (const key of keys) {
      assert.ok(copy[key].trim(), locale + ':' + key);
      if (locale !== 'en') assert.notEqual(copy[key], english[key], locale + ':' + key);
    }
    assert.ok(!html.includes(escape(copy.openCodeV2Description)), locale);
    assert.ok(!html.includes(escape(copy.details)), locale);
    assert.ok(html.includes(escape(mcpSetupMessages(locale).pathLabel)), locale);
    assert.ok(html.includes('OpenCode v2'), locale);
  }
});

test('shared OpenCode discovery help is version-neutral in every locale', () => {
  const model: ApplicationDiscoveryModel = {
    busy: false,
    failed: false,
    offers: [],
    offerError: false,
    acknowledge: async () => {},
    dismiss: () => {},
    refresh: async () => {},
    choose: async () => {},
    snapshot: {
      checkedAt: '2026-11-17T00:00:00Z',
      platform: 'linux',
      offers: [],
      stateError: false,
      applications: [{ client: 'opencode', status: 'detected', instances: [], coverage: [] }],
    },
  };
  for (const locale of supportedLocales) {
    const copy = discoveryMessages(locale);
    const html = renderToStaticMarkup(
      React.createElement(ApplicationDiscovery, { model, locale, client: 'opencode' }),
    );
    assert.ok(html.includes(escape(copy.opencode)), locale);
    assert.ok(!copy.opencode.includes('OpenCode v1'), locale);
    assert.ok(!copy.opencode.includes('OpenCode v2'), locale);
    if (locale !== 'en') assert.notEqual(copy.opencode, discoveryMessages('en').opencode, locale);
  }
});

test('cancelling an unreviewed v2 draft shows unknown status instead of an indefinite checking label', async () => {
  const f = fixture(),
    app = new ApplicationSetupFlow(f.invoke),
    flow = app.openCodeV2;
  await flow.beginManual();
  flow.setConfigurationPath('/isolated/Not reviewed/草稿.json');
  flow.cancel();
  const discovery: ApplicationDiscoveryModel = {
    busy: false,
    failed: false,
    offers: [],
    offerError: false,
    acknowledge: async () => {},
    dismiss: () => {},
    refresh: async () => {},
    choose: async () => {},
    snapshot: {
      checkedAt: '2026-11-17T00:00:00Z',
      platform: 'linux',
      offers: [],
      stateError: false,
      applications: [],
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(ApplicationRows, {
      flow: app,
      discovery,
      invoke: f.invoke,
      locale: 'en',
      onManualSetup: () => {},
      statuses: { statuses: {}, errors: {}, refreshAll: async () => {} },
    }),
  );
  const row = html.slice(
    html.indexOf('data-testid="application-row-opencode-v2"'),
    html.indexOf('data-testid="application-row-codex"'),
  );
  assert.ok(row.includes('>Unknown<'));
  assert.ok(!row.includes(escape(mcpSetupMessages('en').checking)));
  assert.equal(flow.getSnapshot().target?.configurationPath, '/isolated/Not reviewed/草稿.json');
  assert.equal(f.writes(), 0);
});

test('v2 Connect uses actual setup capability without claiming an installed version', async () => {
  const f = fixture(),
    flow = new ApplicationSetupFlow(f.invoke);
  await flow.openCodeV2.refresh();
  const discovery: ApplicationDiscoveryModel = {
    busy: false,
    failed: false,
    offers: [],
    offerError: false,
    acknowledge: async () => {},
    dismiss: () => {},
    refresh: async () => {},
    choose: async () => {},
    snapshot: {
      checkedAt: '2026-11-17T00:00:00Z',
      platform: 'linux',
      offers: [],
      stateError: false,
      applications: [],
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(ApplicationRows, {
      flow,
      discovery,
      invoke: f.invoke,
      locale: 'en',
      onManualSetup: () => {},
      statuses: { statuses: {}, errors: {}, refreshAll: async () => {} },
    }),
  );
  const row = html.slice(
    html.indexOf('data-testid="application-row-opencode-v2"'),
    html.indexOf('data-testid="application-row-codex"'),
  );
  assert.ok(row.includes(applicationSetupMessages('en').automaticAvailable));
  assert.ok(row.includes('data-testid="application-connect-opencode-v2"'));
  assert.ok(!row.includes(applicationSetupMessages('en').detected));
  for (const locale of supportedLocales)
    if (locale !== 'en')
      assert.notEqual(
        applicationSetupMessages(locale).automaticAvailable,
        applicationSetupMessages('en').automaticAvailable,
        locale,
      );
});

test('the startup working-chat hint requires an actual ready bound v2 chat, not saved configuration', () => {
  const snapshot: Pick<Snapshot, 'agents' | 'adapters'> = {
    agents: [],
    adapters: [
      {
        id: 'v2',
        kind: 'opencode-v2',
        label: 'OpenCode v2',
        state: 'ready',
        error: null,
        capabilities: {
          wakeIdle: true,
          receiveActive: true,
          nativeDisplay: true,
          exactSession: true,
        },
      },
    ],
  };
  assert.equal(hasConnectedClientChat('opencode-v2', snapshot), false);
  snapshot.agents.push({
    nickname: 'Выбранное имя',
    key: 'выбранное имя',
    messageCount: 0,
    unread: 0,
    binding: {
      adapterId: 'v2',
      connectionId: 'fixture',
      client: 'OpenCode v2',
      chatId: 'exact-chat',
      generation: 1,
    },
  });
  assert.equal(hasConnectedClientChat('opencode-v2', snapshot), true);
  snapshot.adapters[0].state = 'checking';
  assert.equal(hasConnectedClientChat('opencode-v2', snapshot), false);
});
test('configuration, waiting, unsupported interface, live registration and stopped node are distinct', () => {
  const status: OpenCodeV2SetupStatus = {
    client: 'opencode-v2',
    state: 'configured',
    target,
    targetId: 'profile',
    generation: 'current',
    remembered: true,
    setupAvailability: { state: 'available' },
    files: [],
  };
  for (const locale of supportedLocales) {
    const entry = { targetId: 'profile', generation: 'current', version: '2.2.5' };
    const waiting = openCodeRuntimeText(locale, status, { running: true, openCodeV2Runtime: [] });
    assert.equal(
      openCodeRuntimeText(locale, status, {
        openCodeV2Runtime: [{ ...entry, generation: 'old', state: 'registered' }],
      }),
      waiting,
    );
    const unsupported = openCodeRuntimeText(locale, status, {
      openCodeV2Runtime: [{ ...entry, state: 'unsupported' }],
    });
    const connected = openCodeRuntimeText(locale, status, {
      openCodeV2Runtime: [{ ...entry, state: 'registered' }],
    });
    const stopped = openCodeRuntimeText(locale, status, { running: false });
    assert.equal(new Set([waiting, unsupported, connected, stopped]).size, 4);
    assert.ok(connected.includes('2.2.5') && unsupported.includes('2.2.5'));
  }
});
