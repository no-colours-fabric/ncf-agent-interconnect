import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpenCodeV2SetupFlow } from '../desktop/renderer/opencode-v2-setup-model.js';
import { OpenCodeV2SetupDialog, OpenCodeSetupDialog } from '../desktop/renderer/McpSetup.js';
import { McpSetupFlow } from '../desktop/renderer/mcp-setup-model.js';
import { applicationSetupMessages } from '../desktop/renderer/i18n/application-setup.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import { supportedLocales, type Locale } from '../desktop/renderer/i18n/index.js';
import type { McpSetupInvoke, OpenCodeV2SetupTarget } from '../desktop/shared/mcp-setup.js';

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
      return { client: 'opencode-v2', target, alternatives: [target.configurationPath] };
    if (method === 'opencodeV2SetupStatus')
      return {
        client: 'opencode-v2',
        target: params.target,
        state: 'not-configured',
        remembered: false,
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
            changes: [],
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
      onClose: () => {},
    }),
  );
}

test('v2 manual UI names its version and captured target; v1 keeps a separate legacy form and draft', async () => {
  const f = fixture(),
    flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.beginManual();
  flow.setConfigurationPath('/isolated/Custom v2/草稿.json');
  await flow.review();
  const html = render(flow, 'ru');
  assert.ok(html.includes('id="mcp-setup-form-opencode-v2"'));
  assert.ok(html.includes('OpenCode v2'));
  assert.ok(html.includes(escape('/isolated/Custom v2/草稿.json')));
  assert.ok(html.includes(escape(target.profilePath)));
  assert.ok(html.includes(escape(applicationSetupMessages('ru').openCodeV2Description)));
  assert.doesNotMatch(html, /<select|role="combobox"|Profile [12]/);
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
          { id: 'configuration', path: '/isolated/Legacy v1.json', action: 'create', changes: [] },
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
  assert.equal(f.writes(), 0);
});

test('v2 UI checks only the active original uncertainty; renewed preview shows Apply and separate confirmation', async () => {
  const f = fixture(),
    flow = new OpenCodeV2SetupFlow(f.invoke);
  await flow.beginManual();
  await flow.apply();
  const copy = applicationSetupMessages('en');
  const visible = (html: string) => html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
  const original = flow.getSnapshot().uncertain;
  assert.ok(visible(render(flow)).includes(copy.uncertain));
  assert.ok(visible(render(flow)).includes(copy.checkSetupResult));
  f.change();
  await flow.checkResult();
  const renewed = render(flow);
  assert.ok(!visible(renewed).includes(copy.checkSetupResult));
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
    'openCodeProfile',
    'selectedInstallation',
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
    assert.ok(html.includes(escape(copy.openCodeV2Description)), locale);
    assert.ok(html.includes(escape(copy.openCodeProfile)), locale);
    assert.ok(html.includes(escape(mcpSetupMessages(locale).pathLabel)), locale);
    assert.ok(html.includes('OpenCode v2'), locale);
  }
});
