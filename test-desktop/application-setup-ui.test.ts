import { sessionDeliveryMessages } from '../desktop/renderer/i18n/session-delivery.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ApplicationRows,
  ApplicationTiles,
  NextStep,
  setupApplicationName,
  startupOfferClients,
} from '../desktop/renderer/ApplicationSetup.js';
import { ApplicationSetupFlow } from '../desktop/renderer/application-setup-model.js';
import { applicationSetupMessages } from '../desktop/renderer/i18n/application-setup.js';
import { discoveryMessages } from '../desktop/renderer/i18n/application-discovery.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';
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

test('Startup skips saved ChatGPT setup even when its background delivery needs attention', () => {
  const flow = new ApplicationSetupFlow(noInvoke);
  const offers = ['codex' as const];
  const detected = { ...discovery, offers, snapshot: { ...discovery.snapshot!, offers } };
  const checked: McpSetupStatuses = {
    ...statuses,
    statuses: {
      ...statuses.statuses,
      codex: {
        client: 'codex',
        remembered: true,
        codexConnectRequired: true,
        state: 'configured',
        files: [{ id: 'configuration', path: '/fixture/profile/config.toml', state: 'configured' }],
      },
    },
  };
  assert.deepEqual(startupOfferClients(detected, flow.getSnapshot(), checked), []);
  assert.deepEqual(startupOfferClients(detected, flow.getSnapshot(), statuses), offers);
  flow.dispose();
});

test('startup uses installation major evidence and preserves explicit choices for an unversioned host', async () => {
  const target = {
    major: 2 as const,
    installationId: null,
    installationPath: null,
    profilePath: '/qa',
    configurationPath: '/qa/opencode.json',
  };
  const flow = new ApplicationSetupFlow((async (method) => {
    if (method === 'opencodeV2SetupDefaults')
      return {
        client: 'opencode-v2',
        target,
        alternatives: [],
        setupAvailability: { state: 'available' },
      };
    if (method === 'opencodeV2SetupStatus')
      return {
        client: 'opencode-v2',
        target,
        remembered: false,
        state: 'missing',
        files: [],
        setupAvailability: { state: 'available' },
      };
    throw Error('Startup attempted to write');
  }) as McpSetupInvoke);
  await flow.openCodeV2.refresh();
  const offer = (majors: (1 | 2 | undefined)[], known = statuses) =>
    startupOfferClients(
      {
        ...discovery,
        snapshot: {
          ...discovery.snapshot!,
          offers: ['opencode'],
          applications: [
            {
              client: 'opencode',
              status: 'detected',
              coverage: [],
              instances: majors.map((openCodeMajor, i) => ({
                path: '/qa/' + i,
                form: 'cli',
                evidence: 'package-metadata',
                openCodeMajor,
              })),
            },
          ],
        },
      },
      flow.getSnapshot(),
      known,
    );
  assert.deepEqual(offer([1]), ['opencode']);
  assert.deepEqual(offer([2]), ['opencode-v2']);
  assert.deepEqual(offer([undefined]), ['opencode', 'opencode-v2']);
  assert.deepEqual(offer([1, 2]), ['opencode', 'opencode-v2']);
  const existing: McpSetupStatuses = {
    ...statuses,
    statuses: {
      ...statuses.statuses,
      opencode: {
        client: 'opencode',
        state: 'configured',
        openCodeV1Configuration: true,
        remembered: true,
        files: [],
      },
    },
  };
  assert.deepEqual(offer([1], existing), []);
  assert.deepEqual(offer([2], existing), ['opencode-v2']);
  flow.dispose();
});

test('all five groups retain manual setup; the default v2 target does not infer capability from discovery', () => {
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
  for (const client of mcpSetupClients)
    assert.ok(
      html.includes(
        'data-testid="application-row-' + (client === 'opencode' ? 'opencode-v2' : client) + '"',
      ),
    );
  assert.equal(html.match(/aria-label="Manual setup"/g)?.length, 5);
  assert.equal(html.match(/data-testid="SettingsOutlinedIcon"/g)?.length, 5);
  assert.doesNotMatch(html, />Manual setup</);
  assert.equal(html.match(/data-testid="application-connect-/g)?.length, 2);
  assert.doesNotMatch(html, /cursor-reply-permission|ncf_agent_interconnect:agent_send/);
  assert.ok(html.includes('OpenCode v2'));
  assert.ok(html.includes('OpenCode v1'));
  assert.ok(!html.includes('data-testid="application-connect-opencode-v2"'));
  assert.doesNotMatch(html, /Profile [12]|Not installed|>Ready</);
  assert.ok(html.includes('Automatic setup unavailable'));
  assert.ok(!html.includes(discoveryMessages('en').stateError));
  assert.equal(html.match(/<img /g)?.length, 5);
});

test('configured Cursor has no persistent permission instruction or warning', () => {
  for (const locale of supportedLocales) {
    const html = renderToStaticMarkup(
      React.createElement(ApplicationRows, {
        discovery,
        statuses: {
          ...statuses,
          statuses: {
            ...statuses.statuses,
            cursor: {
              client: 'cursor',
              remembered: true,
              state: 'configured',
              files: [],
              cursorPermission: { state: 'unconfirmed', reason: 'ide-owned' },
            },
          },
        },
        invoke: noInvoke,
        flow: new ApplicationSetupFlow(noInvoke),
        locale,
        onManualSetup: () => {},
      }),
    );
    assert.doesNotMatch(
      html,
      /cursor-permission-unconfirmed|ncf_agent_interconnect:agent_send|Run Everything/,
    );
  }
});

test('current Cursor Connect reports unconfirmed automatic delivery in the standard status', async () => {
  const invoke = (async (method: string) => {
    if (method === 'mcpSetupDefaults')
      return {
        client: 'cursor',
        files: [{ id: 'configuration', path: '/isolated/.cursor/mcp.json' }],
      };
    if (method === 'mcpSetupPreview')
      return {
        client: 'cursor',
        planId: '00000000-0000-4000-8000-000000000001',
        expiresAt: '2030-01-01T00:00:00.000Z',
        requiresReplacement: false,
        files: [
          {
            id: 'configuration',
            path: '/isolated/.cursor/mcp.json',
            action: 'create',
            changes: [{ scope: 'mcpServers.ncf_agent_interconnect', action: 'add' }],
          },
        ],
      };
    if (method === 'mcpSetupApply')
      return {
        status: 'applied',
        files: [{ path: '/isolated/.cursor/mcp.json', status: 'created' }],
        cursorPermission: { state: 'unconfirmed', reason: 'missing' },
      };
    throw new Error('Unexpected method ' + method);
  }) as McpSetupInvoke;
  const flow = new ApplicationSetupFlow(invoke);
  await flow.connect('cursor');
  for (const locale of supportedLocales) {
    const html = renderToStaticMarkup(
      React.createElement(ApplicationRows, {
        discovery,
        statuses,
        invoke: noInvoke,
        flow,
        locale,
        onManualSetup: () => {},
      }),
    );
    assert.match(html, /data-testid="cursor-permission-unconfirmed"/);
    assert.ok(html.includes(mcpSetupMessages(locale).configured), locale);
    assert.ok(
      html.includes(
        renderToStaticMarkup(
          React.createElement(React.Fragment, null, t(locale, 'clientsUnavailableImpact')),
        ),
      ),
      locale,
    );
    assert.doesNotMatch(html, /ncf_agent_interconnect:agent_send|Run Everything/);
  }
});

test('only configured Applications rows show app-specific status metrics', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApplicationRows, {
      discovery,
      statuses: {
        ...statuses,
        statuses: {
          ...statuses.statuses,
          cursor: { client: 'cursor', remembered: true, state: 'configured', files: [] },
          codex: { client: 'codex', remembered: true, state: 'needs-update', files: [] },
        },
      },
      invoke: noInvoke,
      flow: new ApplicationSetupFlow(noInvoke),
      locale: 'en',
      onManualSetup: () => {},
      snapshot: {
        adapters: [
          {
            id: 'cursor-adapter',
            kind: 'cursor-hook',
            label: 'Cursor',
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
        agents: [
          {
            nickname: 'Agent',
            key: 'agent',
            binding: {
              adapterId: 'cursor-adapter',
              client: 'Cursor',
              chatId: 'specific-chat',
              connectionId: 'fixture',
              generation: 1,
            },
            messageCount: 0,
            unread: 0,
          },
          { nickname: 'Unbound', key: 'unbound', binding: null, messageCount: 0, unread: 0 },
        ],
      },
    }),
  );
  assert.equal(html.match(/data-testid="client-status-panel"/g)?.length, 1);
  assert.match(html, /data-testid="client-status-panel" data-client="cursor"/);
  assert.match(html, /data-testid="application-agent-count"[^>]*>1</);
  assert.ok(html.includes(mcpSetupMessages('en')['needs-update']));
});

test('new copy, help and accessibility summaries are complete in all 15 locales without English fallback', () => {
  const english = applicationSetupMessages('en');
  for (const locale of supportedLocales) {
    const copy = applicationSetupMessages(locale);
    assert.deepEqual(Object.keys(copy), Object.keys(english));
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim()));
    assert.ok(copy.claudeConfirmAnswer.includes('Allow'), locale);
    assert.ok(copy.permissionsAnswer.includes('/permissions'), locale);
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
  assert.equal(html.match(/aria-label="Настроить вручную"/g)?.length, 5);
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
  assert.match(html, /OpenCode v1<\/h2>/);
  assert.ok(html.includes('/isolated/OpenCode v1/opencode.json'));
  assert.ok(html.includes('mcp-apply'));
  assert.match(html, /aria-label="Configuration file path"/);
  assert.doesNotMatch(html, />Configuration file path</);
  const hint = html.match(
    /<p[^>]*id="([^"]+)"[^>]*>Choose the configuration file used by this application\./,
  );
  assert.ok(
    hint &&
      hint.index !== undefined &&
      hint.index < html.indexOf('aria-label="Choose file…"', hint.index),
  );
  assert.ok(html.includes('aria-describedby="' + hint[1] + '"'));
  assert.match(html, /aria-label="Choose file…"/);
  assert.match(html, /aria-label="Open configuration file"/);
  assert.match(html, /data-testid="FolderOpenOutlinedIcon"/);
  assert.match(html, /data-testid="OpenInNewOutlinedIcon"/);
  assert.match(html, /Choose…<\/button>/);
  assert.doesNotMatch(html, />(?:Choose file…|Open configuration file)</);
  assert.match(html, /role="combobox"/);
  assert.doesNotMatch(html, /<select|Profile [12]/);
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
  const current = render();
  const copy = applicationSetupMessages('en');
  assert.doesNotMatch(current, /<details\b/);
  assert.ok(current.includes(copy.uncertain));
  assert.ok(current.includes(copy.checkSetupResult));
  assert.ok(!current.includes(mcpSetupMessages('en').failed));
  await flow.apply();
  assert.equal(writes, 1, 'fresh target preparation is read-only');
  assert.equal(flow.getSnapshot().reviewRequired, true);
  const renewed = render();
  assert.doesNotMatch(renewed, /<details\b/);
  assert.ok(!renewed.includes(copy.checkSetupResult));
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

for (const scenario of [
  { name: 'v1 configuration only', configured: true, major: null, shown: true },
  { name: 'v1 configuration with only v2 installed', configured: true, major: 2, shown: true },
  { name: 'v1 installation only', configured: false, major: 1, shown: true },
  { name: 'v1 configuration and installation', configured: true, major: 1, shown: true },
  { name: 'v2 installation only', configured: false, major: 2, shown: false },
  { name: 'unversioned discovery only', configured: false, major: undefined, shown: false },
  { name: 'neither configuration nor detection', configured: false, major: null, shown: false },
] as const) {
  test('OpenCode v1 default in Applications and compact setup: ' + scenario.name, () => {
    let setupCalls = 0;
    const invoke: McpSetupInvoke = () => {
      setupCalls++;
      throw new Error('Rendering the default must be read-only');
    };
    const props = {
      discovery: {
        ...discovery,
        snapshot: {
          ...discovery.snapshot!,
          applications: [
            {
              client: 'opencode' as const,
              status:
                scenario.major === null
                  ? ('not-found-in-known-locations' as const)
                  : ('detected' as const),
              instances:
                scenario.major === null
                  ? []
                  : [
                      {
                        path: '/isolated/OpenCode',
                        form: 'cli' as const,
                        evidence: 'package-metadata' as const,
                        openCodeMajor: scenario.major,
                      },
                    ],
              coverage: [],
            },
          ],
        },
      },
      statuses: {
        ...statuses,
        statuses: {
          opencode: {
            client: 'opencode' as const,
            remembered: false,
            openCodeV1Configuration: scenario.configured,
            state: scenario.configured ? ('not-configured' as const) : ('missing' as const),
            files: [],
          },
        },
      },
      invoke,
      flow: new ApplicationSetupFlow(invoke),
      locale: 'en' as const,
      onManualSetup: () => {},
    };
    for (const [view, row] of [
      [
        React.createElement(McpSetup, {
          client: 'opencode',
          manualClient: null,
          discovery: props.discovery,
          invoke,
          onClientChange: () => {},
          setupStatuses: props.statuses,
          setupFlow: props.flow,
        }),
        'application-row-opencode',
      ],
      [React.createElement(ApplicationTiles, props), 'overview-application-opencode'],
    ] as const) {
      const html = renderToStaticMarkup(view);
      const toggle = html.match(/<input\b[^>]*aria-label="Show OpenCode v1"[^>]*>/)?.[0];
      assert.ok(toggle, row);
      assert.equal(toggle.includes('checked=""'), scenario.shown, row);
      assert.equal(html.includes('data-testid="' + row + '"'), scenario.shown, row);
      assert.ok(html.includes('data-testid="' + row + '-v2"'), row);
    }
    assert.equal(setupCalls, 0);
  });
}

test('Overview shares the startup tiles without startup chrome, technical discovery controls or offer acknowledgements', () => {
  const props = {
    discovery,
    statuses,
    invoke: noInvoke,
    flow: new ApplicationSetupFlow(noInvoke),
    locale: 'en' as const,
    onManualSetup: () => {},
  };
  const html = renderToStaticMarkup(React.createElement(ApplicationTiles, props));
  assert.equal(
    html.match(/data-testid="overview-application-(?:cursor|opencode-v2|codex|aionui|claude)"/g)
      ?.length,
    5,
  );
  assert.equal(html.match(/<img /g)?.length, 5);
  assert.ok(html.includes('data-testid="overview-group-opencode"'));
  assert.ok(html.includes('Show OpenCode v1'));
  assert.ok(!html.includes('data-testid="overview-application-opencode"'));
  for (const text of [
    applicationSetupMessages('en').startupTitle,
    applicationSetupMessages('en').returnHelp,
    applicationSetupMessages('en').continue,
    discoveryMessages('en').details,
    discoveryMessages('en').choose,
  ])
    assert.ok(!html.includes(text), text);
  assert.doesNotMatch(html, /data-offer-client=|role="dialog"|<header|<footer/);
  const startup = renderToStaticMarkup(
    React.createElement(ApplicationTiles, {
      ...props,
      context: 'startup',
      offers: ['cursor', 'opencode', 'codex'],
    }),
  );
  assert.equal(startup.match(/data-offer-client=/g)?.length, 3);
  assert.ok(startup.includes('data-offer-client="opencode"'));
  assert.ok(startup.includes('data-testid="startup-connect-cursor"'));
});

test('all manual routes keep configuration setup without the installation discovery or Setup details sections', () => {
  for (const target of [...mcpSetupClients, 'opencode-v2'] as const) {
    const client = target === 'opencode-v2' ? 'opencode' : target;
    const source = '/isolated/Applications/' + client + '/检查';
    const model: ApplicationDiscoveryModel = {
      ...discovery,
      snapshot: {
        ...discovery.snapshot!,
        applications: [
          {
            client,
            status: 'unknown',
            instances: [],
            coverage: [{ source, state: 'partial', reason: 'unsupported-package-format' }],
          },
        ],
      },
    };
    const flow = new ApplicationSetupFlow(noInvoke);
    if (target === 'opencode') flow.openCodeV2.selectManualMajor(1);
    const html = renderToStaticMarkup(
      React.createElement(McpSetup, {
        client,
        manualClient: client,
        onClientChange: () => {},
        onCloseManual: () => {},
        invoke: noInvoke,
        discovery: model,
        setupStatuses: statuses,
        setupFlow: flow,
        locale: 'en',
      }),
    );
    assert.ok(!html.includes('data-testid="application-discovery"'), target);
    assert.ok(!html.includes(applicationSetupMessages('en').details), target);
    assert.ok(!html.includes('Copy connection prompt'), target);
    assert.ok(!html.includes('Connect as agent &lt;a name you choose&gt;.'), target);
    if (target === 'claude') {
      assert.doesNotMatch(
        html,
        /claude-launch-command|>claude<|Start Claude Code|Copy launch command/,
      );
    }
    for (const text of [
      discoveryMessages('en').choose,
      discoveryMessages('en').details,
      discoveryMessages('en').refresh,
      discoveryMessages('en').limited,
      source,
    ])
      assert.ok(!html.includes(text), target + ':' + text);
    assert.ok(html.includes(applicationSetupMessages('en').back), target);
    const card = html.match(
      new RegExp('<section[^>]*id="mcp-setup-form-' + target + '"[^>]*>[\\s\\S]*?</section>'),
    )?.[0];
    assert.ok(card, target);
    assert.ok(card.includes('aria-labelledby="mcp-setup-page-' + target + '"'), target);
    assert.equal(card.match(/<button[^>]*class="[^"]*\bMuiButton-sizeSmall\b/g)?.length, 1, target);
    assert.doesNotMatch(card, />Cancel</, target);
    assert.match(html, /data-testid="(?:mcp|opencode-v2)-settings-status"/, target);
    const copy = mcpSetupMessages('en');
    for (const intro of [copy.cursorDescription, copy.codexDescription, copy.claudeDescription])
      assert.ok(!html.includes(intro), target);
    assert.doesNotMatch(card, /<h[1-6]\b|MuiDialog(?:Title|Content|Actions)-root/, target);
    assert.match(
      card.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ''),
      /<footer[^>]*><button[^>]*data-testid="(?:mcp|opencode-v2)-apply"[\s\S]*<\/footer>/,
      target,
    );
    flow.dispose();
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
      const rowId = (client: string) => (client === 'opencode' ? 'opencode-v2' : client);
      const row = (client: string, next?: string) =>
        html.slice(
          html.indexOf('data-testid="application-row-' + rowId(client) + '"'),
          next ? html.indexOf('data-testid="application-row-' + rowId(next) + '"') : undefined,
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

test('unconfigured ChatGPT uses the common row with no advance restart instruction', () => {
  for (const locale of supportedLocales) {
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
    const row = html.slice(
      html.indexOf('data-testid="application-row-codex"'),
      html.indexOf('data-testid="application-row-aionui"'),
    );
    assert.ok(row.includes('data-testid="application-connect-codex"'), locale);
    assert.ok(row.includes('data-testid="application-manual-codex"'), locale);
    assert.doesNotMatch(row, /data-testid="application-guidance-codex"/);
    assert.ok(!row.includes(sessionDeliveryMessages[locale].connectRestart), locale);
    assert.ok(sessionDeliveryMessages[locale].connectRestartTitle.includes('ChatGPT'), locale);
    if (locale !== 'en')
      assert.notEqual(
        sessionDeliveryMessages[locale].connectRestartTitle,
        sessionDeliveryMessages.en.connectRestartTitle,
      );
  }
});

test('Applications rows keep setup status and manual actions with immediate unheaded guidance', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApplicationRows, {
      discovery,
      statuses: {
        ...statuses,
        statuses: {
          ...statuses.statuses,
          codex: { client: 'codex', remembered: true, state: 'configured', files: [] },
        },
      },
      invoke: noInvoke,
      flow: new ApplicationSetupFlow(noInvoke),
      locale: 'en',
      onManualSetup: () => {},
    }),
  );
  const row = html.slice(
    html.indexOf('data-testid="application-row-codex"'),
    html.indexOf('data-testid="application-row-aionui"'),
  );
  assert.ok(row.includes('data-testid="client-status-panel"'));
  assert.ok(row.includes('>' + mcpSetupMessages('en').statusMcpConfig + '</dt>'));
  assert.equal(row.split('>' + mcpSetupMessages('en').configured + '<').length - 1, 1);
  assert.ok(row.includes('width="44" height="44"'));
  assert.ok(!row.includes('data-testid="application-configured-codex"'));
  assert.ok(!row.includes('aria-expanded'));
  assert.ok(row.includes('data-testid="application-guidance-codex"'));
  assert.ok(row.includes(sessionDeliveryMessages.en.connectRestart));
  assert.ok(!row.includes(applicationSetupMessages('en').nextStep));
  assert.ok(!row.includes(' hidden='));
  assert.ok(row.includes('data-testid="application-manual-codex"'));
  assert.equal(html.match(/aria-label="Manual setup"/g)?.length, 5);
  assert.ok(!row.includes('<summary'));
  assert.ok(!html.includes(applicationSetupMessages('en').yourApps));
  assert.ok(!html.includes(applicationSetupMessages('en').intro));
  assert.ok(html.includes(applicationSetupMessages('en').detectionHelp));
  const refresh = html.match(/<button[^>]*MuiLink-root[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(refresh?.includes('data-testid="RefreshOutlinedIcon"'));
  assert.ok(refresh?.endsWith(discoveryMessages('en').refresh + '</button>'));
  assert.ok(!html.includes('Newly detected apps will appear here'));
});

test('Applications next steps omit connection commands and their Copy action in every locale, while shared startup guidance retains them', () => {
  const escaped = (text: string) =>
    renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7);
  for (const locale of supportedLocales) {
    for (const client of [...mcpSetupClients, 'opencode-v2'] as const) {
      const html = renderToStaticMarkup(
        React.createElement(NextStep, {
          client,
          invoke: noInvoke,
          locale,
          showConnectionPrompt: false,
        }),
      );
      const copy = mcpSetupMessages(locale);
      assert.ok(!html.includes(escaped(copy.connectionPrompt)), locale + client);
      assert.ok(!html.includes(escaped(copy.copyPrompt)), locale + client);
      assert.ok(html.includes(escaped(applicationSetupMessages(locale).nextStep)), locale + client);
    }
  }
  const startup = renderToStaticMarkup(
    React.createElement(NextStep, { client: 'opencode-v2', invoke: noInvoke, locale: 'en' }),
  );
  assert.ok(startup.includes(escaped(mcpSetupMessages('en').connectionPrompt)));
  assert.ok(startup.includes(escaped(mcpSetupMessages('en').copyPrompt)));
});

test('Applications working guidance requires a current ready bound chat, not saved configuration or an old binding', () => {
  for (const mode of ['ready', 'checking', 'released', 'error'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(ApplicationRows, {
        discovery,
        statuses: {
          ...statuses,
          statuses: {
            ...statuses.statuses,
            codex: { client: 'codex', remembered: true, state: 'configured', files: [] },
          },
        },
        snapshot: {
          adapters: [
            {
              id: 'codex-live',
              label: 'Codex',
              kind: 'codex-desktop',
              state: mode === 'checking' ? 'checking' : mode === 'error' ? 'error' : 'ready',
              released: mode === 'released',
              error: mode === 'error' ? 'Isolated error' : null,
              capabilities: {
                wakeIdle: true,
                receiveActive: true,
                nativeDisplay: true,
                exactSession: true,
              },
            },
          ],
          agents: [
            {
              key: 'test',
              nickname: 'Test',
              messageCount: 0,
              unread: 0,
              binding: {
                adapterId: 'codex-live',
                chatId: 'intended',
                client: 'Codex',
                connectionId: 'isolated',
                generation: 1,
              },
            },
          ],
        },
        invoke: noInvoke,
        flow: new ApplicationSetupFlow(noInvoke),
        locale: 'en',
        onManualSetup: () => {},
      }),
    );
    const row = html.slice(
      html.indexOf('data-testid="application-row-codex"'),
      html.indexOf('data-testid="application-row-aionui"'),
    );
    assert.ok(row.includes('data-testid="application-guidance-codex"'), mode);
    assert.ok(!row.includes('data-testid="application-configured-codex"'), mode);
    assert.ok(!row.includes('Copy connection prompt'), mode);
    assert.ok(row.includes(sessionDeliveryMessages.en.connectRestart), mode);
    assert.ok(!row.includes('Connect as agent &lt;a name you choose&gt;'), mode);
  }
});

test('inline working hints are one localized paragraph with the exact visible command and no heading or Copy', () => {
  const escaped = (text: string) =>
    renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7);
  const english = applicationSetupMessages('en').readyChatHelp;
  for (const locale of supportedLocales) {
    const copy = applicationSetupMessages(locale).readyChatHelp;
    assert.equal(copy.match(/\{command\}/g)?.length, 1, locale);
    if (locale !== 'en') assert.notEqual(copy, english, locale);
    const html = renderToStaticMarkup(
      React.createElement(NextStep, {
        client: 'cursor',
        locale,
        invoke: noInvoke,
        inline: true,
        working: true,
      }),
    );
    const [before, after] = copy.split('{command}');
    assert.ok(html.includes(escaped(before)), locale);
    assert.ok(html.includes(escaped(after)), locale);
    assert.ok(
      html.includes(
        escaped(mcpSetupMessages(locale).connectionPrompt.replace(/[.。]$/u, '')) + '</code>',
      ),
      locale,
    );
    assert.ok(html.includes('font-family:inherit'), locale);
    assert.ok(html.includes('font-style:italic'), locale);
    assert.ok(html.includes('background-color:'), locale);
    assert.ok(!html.includes('font-family:monospace'), locale);
    assert.equal(html.match(/<p\b/g)?.length, 1, locale);
    assert.doesNotMatch(html, /<h[1-6]\b|<button\b|<summary\b/, locale);
  }
});
