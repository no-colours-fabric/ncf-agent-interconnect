import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { AgentsPage } from '../desktop/renderer/AgentsPage.js';
import { agentEntryMessages } from '../desktop/renderer/i18n/agent-entry.js';
import { supportedLocales, t, type Locale } from '../desktop/renderer/i18n/index.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import { createAppTheme } from '../desktop/renderer/theme.js';
import type { Snapshot } from '../desktop/shared/contracts.js';

const emptySnapshot = (): Snapshot => ({
  running: true,
  nodeId: '00000000-0000-4000-8000-000000000001',
  nodeLabel: 'Local',
  mcpUrl: 'http://127.0.0.1:1',
  peerUrl: 'ws://127.0.0.1:2',
  listenHost: '127.0.0.1',
  localAddresses: [],
  peers: [],
  agents: [],
  directories: [
    {
      nodeId: '00000000-0000-4000-8000-000000000001',
      nodeLabel: 'Local',
      local: true,
      state: 'ready',
      epoch: '00000000-0000-4000-8000-000000000002',
      revision: 1,
      updatedAt: null,
      total: 0,
      truncated: false,
      agents: [],
    },
  ],
  adapters: [],
  exportRoots: [],
  errors: [],
});

const escaped = (text: string) =>
  renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);

function renderAgents(snapshot: Snapshot, locale: Locale): string {
  return renderToStaticMarkup(
    createElement(
      ThemeProvider,
      { theme: createAppTheme('light') },
      createElement(AgentsPage, {
        snapshot,
        locale,
        nodeName: () => 'Local',
        call: async () => {
          throw new Error('Static rendering must not invoke the node.');
        },
        run: async () => {},
        onError: () => {},
        onAdd: () => {},
        onCleared: () => {},
      }),
    ),
  );
}

test('Agents exposes only two link actions before the table, without the connection panel or command', () => {
  const copy = agentEntryMessages('en');
  const html = renderAgents(emptySnapshot(), 'en');
  assert.ok(html.includes('data-testid="agents-page-actions"'));
  for (const removed of [
    'agents-connection-panel',
    'agents-creation-guidance',
    'agent-connection-command',
    'copy-agent-connection-command',
  ])
    assert.ok(!html.includes('data-testid="' + removed + '"'), removed);
  assert.ok(!html.includes(escaped(copy.agentsConnectionGuide)));
  assert.ok(html.includes(escaped(copy.agentsManualDiagnosticAction)));
  const manual = html.match(
    /<button\b[^>]*data-testid="create-agent-manually"[^>]*>[\s\S]*?<\/button>/,
  );
  const clear = html.match(
    /<button\b[^>]*data-testid="clear-all-local-agents"[^>]*>[\s\S]*?<\/button>/,
  );
  assert.ok(manual && clear);
  assert.ok(manual[0].includes('MuiLink-root'));
  assert.ok(clear[0].includes('MuiLink-root'));
  assert.ok(!manual[0].includes('disabled=""'));
  assert.ok(
    clear[0].includes('disabled=""'),
    'clearing remains unavailable when there are no local agents',
  );
  assert.ok(html.includes('data-testid="agents-empty"'));
  assert.ok(html.includes(escaped(copy.agentEmptyPrompt)));
  const order = [
    'agents-page-actions',
    'create-agent-manually',
    'clear-all-local-agents',
    'agents-empty',
  ].map((id) => html.indexOf('data-testid="' + id + '"'));
  assert.ok(order.every((offset, index) => offset >= 0 && (!index || offset > order[index - 1])));
});

test('Agents action links preserve unknown bound-agent status and the existing table', () => {
  const snapshot = emptySnapshot();
  snapshot.adapters.push({
    id: 'aion',
    label: 'AionUi',
    kind: 'aionui',
    state: 'recovering',
    error: null,
    capabilities: { wakeIdle: true, receiveActive: true, nativeDisplay: true, exactSession: true },
  });
  snapshot.agents.push({
    nickname: 'Диагност',
    key: 'диагност',
    binding: {
      connectionId: '00000000-0000-4000-8000-000000000003',
      client: 'AionUi',
      chatId: 'chat',
      adapterId: 'aion',
      generation: 1,
    },
    messageCount: 0,
    unread: 0,
  });
  snapshot.directories[0].agents.push({
    nickname: 'Диагност',
    availability: 'unknown',
    delivery: 'unknown',
  });
  snapshot.directories[0].total = 1;
  const html = renderAgents(snapshot, 'ru');
  const copy = agentEntryMessages('ru');
  assert.ok(html.includes(escaped(copy.agentsManualDiagnosticAction)));
  assert.ok(!html.includes(escaped(copy.agentsCreationConnected.split('{applications}')[0])));
  assert.ok(!html.includes(escaped(copy.agentsCreationNoConnected.split('{applicationsPage}')[0])));
  assert.ok(html.includes('Диагност'));
  assert.ok(html.includes('AionUi'));
  assert.ok(!html.includes(t('ru', 'directoryOnline')));
});

test('both action links are localized in all 15 locales without restoring the removed guide or Copy', () => {
  const english = agentEntryMessages('en').agentsManualDiagnosticAction;
  for (const locale of supportedLocales) {
    const html = renderAgents(emptySnapshot(), locale);
    const manual = agentEntryMessages(locale).agentsManualDiagnosticAction;
    assert.ok(html.includes(escaped(manual)), locale);
    assert.ok(html.includes(escaped(t(locale, 'clearAllLocalAgents'))), locale);
    assert.ok(!html.includes(escaped(mcpSetupMessages(locale).connectionPrompt)), locale);
    assert.ok(!html.includes('data-testid="copy-agent-connection-command"'), locale);
    if (locale !== 'en') assert.notEqual(manual, english, locale);
  }
});
