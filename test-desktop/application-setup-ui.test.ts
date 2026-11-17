import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationRows } from '../desktop/renderer/ApplicationSetup.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import { applicationSetupMessages } from '../desktop/renderer/i18n/application-setup.js';
import { discoveryMessages } from '../desktop/renderer/i18n/application-discovery.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';
import type { ApplicationDiscoveryModel } from '../desktop/renderer/useApplicationDiscovery.js';
import { mcpSetupClients, type McpSetupInvoke } from '../desktop/shared/mcp-setup.js';
import type { McpSetupStatuses } from '../desktop/renderer/mcp-setup-status.js';
import { McpSetupFlow } from '../desktop/renderer/mcp-setup-model.js';
import { OpenCodeSetupDialog } from '../desktop/renderer/McpSetup.js';
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
