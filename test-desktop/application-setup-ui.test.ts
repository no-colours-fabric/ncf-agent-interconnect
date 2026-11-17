import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationRows, setupApplicationName } from '../desktop/renderer/ApplicationSetup.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import { applicationSetupMessages } from '../desktop/renderer/i18n/application-setup.js';
import { discoveryMessages } from '../desktop/renderer/i18n/application-discovery.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';
import type { ApplicationDiscoveryModel } from '../desktop/renderer/useApplicationDiscovery.js';
import { mcpSetupClients, type McpSetupInvoke } from '../desktop/shared/mcp-setup.js';
import type { McpSetupStatuses } from '../desktop/renderer/mcp-setup-status.js';
import { McpSetupFlow } from '../desktop/renderer/mcp-setup-model.js';
import { McpSetup, OpenCodeSetupDialog } from '../desktop/renderer/McpSetup.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';

const noInvoke = (async () => {
  throw new Error('Rendering must not invoke setup');
}) as McpSetupInvoke;
const discovery: ApplicationDiscoveryModel = {
  busy: false,
  failed: false,
  offers: [],
  offerError: true,
  acknowledge: async () => {},
  dismiss: () => {},
  refresh: async () => {},
  choose: async () => {},
  snapshot: {
    checkedAt: '2026-11-17T00:00:00.000Z',
    platform: 'linux',
    offers: [],
    stateError: true,
    applications: mcpSetupClients.map((client) => ({
      client,
      status:
        client === 'cursor' || client === 'codex'
          ? 'detected'
          : client === 'claude'
            ? 'not-found-in-known-locations'
            : 'unknown',
      instances: [],
      coverage: [],
    })),
  },
};
const statuses: McpSetupStatuses = {
  statuses: Object.fromEntries(
    mcpSetupClients.map((client) => [
      client,
      { client, remembered: false, state: 'missing', files: [] },
    ]),
  ),
  errors: {},
  refreshAll: async () => {},
};

test('all five apps retain manual setup; detection enables only automatic actions and never claims absence or v2 support', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApplicationRows, {
      discovery,
      statuses,
      invoke: noInvoke,
      flow: new ApplicationSetupFlow(noInvoke),
      locale: 'en',
      onManualSetup: () => {},
    }),
  );
  for (const client of mcpSetupClients) assert.ok(html.includes('application-row-' + client));
  assert.equal(html.match(/>Manual setup</g)?.length, 5);
  assert.equal(html.match(/data-testid="application-connect-/g)?.length, 2);
  assert.ok(html.includes('OpenCode v1'));
  assert.doesNotMatch(html, /OpenCode v2|Profile [12]|Not installed|>Ready</);
  assert.ok(html.includes('Automatic setup unavailable'));
  assert.ok(!html.includes(discoveryMessages('en').stateError));
  assert.equal(html.match(/<img /g)?.length, 5);
});

test('new copy, help and accessibility summaries are complete in all 15 locales without English fallback', () => {
  const english = applicationSetupMessages('en');
  for (const locale of supportedLocales) {
    const copy = applicationSetupMessages(locale);
    assert.deepEqual(Object.keys(copy), Object.keys(english));
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim()));
    for (const tool of ['agent_read', 'agent_connect', 'agent_send'])
      assert.ok(copy.permissionsAnswer.includes(tool));
    assert.ok(copy.startupHelp.includes('NCF Agent Interconnect'));
    if (locale !== 'en')
      for (const key of ['manual', 'nextStep', 'confirmHelp', 'failed', 'uncertain'] as const)
        assert.notEqual(copy[key], english[key], locale + ':' + key);
    const html = renderToStaticMarkup(
      React.createElement(ApplicationRows, {
        discovery,
        statuses,
        invoke: noInvoke,
        flow: new ApplicationSetupFlow(noInvoke),
        locale,
        onManualSetup: () => {},
      }),
    );
    assert.equal(html.match(/data-testid="application-row-/g)?.length, 5);
  }
});

test('a setup failure stays with its app, keeps manual recovery and cannot appear as a global bookkeeping warning', async () => {
  const flow = new ApplicationSetupFlow((async () => {
    throw new Error('Isolated read failure');
  }) as McpSetupInvoke);
  await flow.connect('cursor');
  const html = renderToStaticMarkup(
    React.createElement(ApplicationRows, {
      discovery,
      statuses,
      invoke: noInvoke,
      flow,
      locale: 'ru',
      onManualSetup: () => {},
    }),
  );
  assert.ok(html.includes(applicationSetupMessages('ru').failed));
  assert.equal(html.match(/role="alert"/g)?.length, 1);
  assert.equal(html.match(/>Настроить вручную</g)?.length, 5);
  assert.ok(!html.includes(discoveryMessages('ru').stateError));
});

test('the real OpenCode v1 manual form keeps its selected file, review and Apply without a profile/version select', async () => {
  const flow = new McpSetupFlow('opencode', (async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'opencode',
        files: [
          {
            id: 'configuration',
            path: '/isolated/OpenCode v1/opencode.json',
            format: 'jsonc',
            alternatives: [],
          },
        ],
      };
    if (method === 'mcpSetupPreview')
      return {
        client: 'opencode',
        planId: 'manual-only',
        files: [
          {
            id: 'configuration',
            path: '/isolated/OpenCode v1/opencode.json',
            action: 'create',
            changes: [],
          },
        ],
        requiresReplacement: false,
      };
    throw new Error('Unexpected isolated read');
  }) as McpSetupInvoke);
  await flow.begin();
  const html = renderToStaticMarkup(
    React.createElement(OpenCodeSetupDialog, {
      invoke: noInvoke,
      messages: mcpSetupMessages('en'),
      locale: 'en',
      inline: true,
      flow,
    }),
  );
  assert.ok(html.includes('Configure OpenCode v1'));
  assert.ok(html.includes('/isolated/OpenCode v1/opencode.json'));
  assert.ok(html.includes('mcp-apply'));
  assert.ok(html.includes('Choose file'));
  assert.doesNotMatch(html, /<select|role="combobox"|Profile [12]/);
});

test('copy context: all 15 locales name the original check, generic copied text and qualified AionUi target', () => {
  const english = applicationSetupMessages('en');
  assert.equal(english.checkSetupResult, 'Check setup result');
  assert.equal(english.copyFailed, 'Could not copy the text. Try again.');
  assert.equal(english.aionUiName, 'AionUi with Cursor Agent');
  for (const locale of supportedLocales) {
    const copy = applicationSetupMessages(locale);
    for (const key of ['checkSetupResult', 'copyFailed', 'aionUiName'] as const) {
      assert.ok(copy[key].trim(), locale + ':' + key);
      if (locale !== 'en') assert.notEqual(copy[key], english[key], locale + ':' + key);
    }
    assert.ok(copy.aionUiName.includes('AionUi') && copy.aionUiName.includes('Cursor Agent'));
    assert.equal(setupApplicationName('aionui', locale), copy.aionUiName);
  }
});

test('copy context: current uncertain attempt has a visible check summary; renewed preview keeps Apply and confirmation', async () => {
  let previews = 0;
  let writes = 0;
  const invoke = (async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'opencode',
        files: [
          {
            id: 'configuration',
            path: '/isolated/original.json',
            format: 'jsonc',
            alternatives: [],
          },
        ],
      };
    if (method === 'mcpSetupPreview')
      return {
        client: 'opencode',
        planId: 'preview-' + ++previews,
        expiresAt: '2030-01-01T00:00:00Z',
        requiresReplacement: false,
        files: [
          {
            id: 'configuration',
            path: previews === 1 ? '/isolated/original.json' : '/isolated/new-target.json',
            action: 'create',
            changes: [],
          },
        ],
      };
    if (method === 'mcpSetupApply') {
      writes++;
      throw new Error('Original response is unknown');
    }
    return {};
  }) as McpSetupInvoke;
  const flow = new McpSetupFlow('opencode', invoke);
  await flow.begin();
  await flow.apply();
  const render = () =>
    renderToStaticMarkup(
      React.createElement(OpenCodeSetupDialog, {
        invoke,
        messages: mcpSetupMessages('en'),
        locale: 'en',
        inline: true,
        flow,
      }),
    );
  const visible = (html: string) => html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
  const current = visible(render());
  const copy = applicationSetupMessages('en');
  assert.ok(current.includes(copy.uncertain), 'uncertainty must be outside collapsed Details');
  assert.ok(current.includes(copy.checkSetupResult));
  assert.ok(!current.includes(mcpSetupMessages('en').failed));
  await flow.apply();
  assert.equal(writes, 1, 'fresh target preparation is read-only');
  assert.equal(flow.getSnapshot().reviewRequired, true);
  const renewed = render();
  assert.ok(!visible(renewed).includes(copy.checkSetupResult));
  assert.ok(renewed.includes('>Apply<'));
  assert.ok(renewed.includes(copy.reviewHelp));
  assert.ok(renewed.includes('type="checkbox"'));
  assert.ok(renewed.includes('Original response is unknown'), 'original history is retained');
  assert.equal(flow.getSnapshot().uncertain?.preview.planId, 'preview-1');
  const automatic = new ApplicationSetupFlow((async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'cursor',
        files: [{ id: 'configuration', path: '/isolated/automatic.json' }],
      };
    if (method === 'mcpSetupPreview')
      return {
        client: 'cursor',
        planId: 'automatic-original',
        requiresReplacement: false,
        files: [
          { id: 'configuration', path: '/isolated/automatic.json', action: 'create', changes: [] },
        ],
      };
    if (method === 'mcpSetupApply') throw new Error('Unknown automatic result');
    return {};
  }) as McpSetupInvoke);
  await automatic.connect('cursor');
  const cachedConfigured: McpSetupStatuses = {
    ...statuses,
    statuses: {
      ...statuses.statuses,
      cursor: { client: 'cursor', remembered: true, state: 'configured', files: [] },
    },
  };
  const automaticHtml = visible(
    renderToStaticMarkup(
      React.createElement(ApplicationRows, {
        discovery,
        statuses: cachedConfigured,
        invoke: noInvoke,
        flow: automatic,
        locale: 'en',
        onManualSetup: () => {},
      }),
    ),
  );
  assert.ok(automaticHtml.includes(copy.uncertain));
  assert.ok(
    automaticHtml.includes(copy.checkSetupResult),
    'cached configuration presence must not hide the original-result check',
  );
});

test('copy context: list and manual AionUi headings qualify the Cursor Agent target', () => {
  for (const locale of ['en', 'ru'] as const) {
    const copy = applicationSetupMessages(locale);
    const rows = renderToStaticMarkup(
      React.createElement(ApplicationRows, {
        discovery,
        statuses,
        invoke: noInvoke,
        flow: new ApplicationSetupFlow(noInvoke),
        locale,
        onManualSetup: () => {},
      }),
    );
    const manual = renderToStaticMarkup(
      React.createElement(McpSetup, {
        discovery,
        client: 'aionui',
        manualClient: 'aionui',
        onClientChange: () => {},
        invoke: noInvoke,
        setupStatuses: statuses,
        locale,
        messages: mcpSetupMessages(locale),
      }),
    );
    for (const html of [rows, manual]) {
      const headings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)].map((match) =>
        match[1].replace(/<[^>]*>/g, ''),
      );
      assert.ok(headings.includes(copy.aionUiName));
      assert.ok(!headings.includes('AionUi'));
    }
  }
});

test('alignment fixture preserves mixed manual-only, configured, busy and error content in the correct application row', async () => {
  for (const locale of ['en', 'ru', 'de'] as const) {
    for (const mode of ['mixed', 'busy', 'error'] as const) {
      const calls: string[] = [];
      const invoke = (async (method: string) => {
        calls.push(method);
        assert.equal(method, 'mcpSetupDefaults');
        if (mode === 'busy') return new Promise(() => {});
        throw new Error('Isolated alignment fixture read failure');
      }) as McpSetupInvoke;
      const flow = new ApplicationSetupFlow(invoke);
      if (mode !== 'mixed') {
        const result = flow.connect('cursor');
        if (mode === 'error') await result;
      }
      const html = renderToStaticMarkup(
        React.createElement(ApplicationRows, {
          discovery: {
            ...discovery,
            snapshot: {
              ...discovery.snapshot!,
              applications: discovery.snapshot!.applications.map((app) => ({
                ...app,
                status:
                  app.client === 'cursor' || app.client === 'aionui'
                    ? ('detected' as const)
                    : ('unknown' as const),
              })),
            },
          },
          statuses: {
            ...statuses,
            statuses: {
              ...statuses.statuses,
              codex: { client: 'codex', remembered: true, state: 'configured', files: [] },
            },
            errors: { claude: 'Isolated status read failure' },
          },
          invoke,
          flow,
          locale,
          onManualSetup: () => {},
        }),
      );
      const row = (client: string, next?: string) =>
        html.slice(
          html.indexOf('data-testid="application-row-' + client + '"'),
          next ? html.indexOf('data-testid="application-row-' + next + '"') : undefined,
        );
      assert.equal(html.match(/data-testid="application-connect-/g)?.length, 2, locale + mode);
      assert.ok(row('cursor', 'opencode').includes('data-testid="application-connect-cursor"'));
      assert.ok(!row('opencode', 'codex').includes('data-testid="application-connect-'));
      assert.ok(row('codex', 'aionui').includes(mcpSetupMessages(locale).configured));
      assert.ok(row('claude').includes(mcpSetupMessages(locale).unavailable));
      for (const client of mcpSetupClients) {
        const current = row(client, mcpSetupClients[mcpSetupClients.indexOf(client) + 1]);
        assert.ok(
          current.includes(applicationSetupMessages(locale).manual),
          client + locale + mode,
        );
      }
      if (mode === 'busy') {
        assert.ok(row('cursor', 'opencode').includes(applicationSetupMessages(locale).connecting));
        assert.equal(html.match(/<button[^>]*disabled=""/g)?.length, 8);
      }
      if (mode === 'error') {
        assert.equal(html.match(/role="alert"/g)?.length, 1);
        assert.ok(row('cursor', 'opencode').includes(applicationSetupMessages(locale).failed));
      }
      assert.deepEqual(calls, mode === 'mixed' ? [] : ['mcpSetupDefaults']);
      flow.dispose();
    }
  }
});
