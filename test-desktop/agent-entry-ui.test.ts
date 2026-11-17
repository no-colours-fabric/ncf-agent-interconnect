import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { AgentsPage } from '../desktop/renderer/AgentsPage.js';
import { agentEntryMessages } from '../desktop/renderer/i18n/agent-entry.js';
import { supportedLocales, t, type Locale } from '../desktop/renderer/i18n/index.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import { lanSearchMessages } from '../desktop/renderer/i18n/lan-search.js';
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

test('compact connection panel keeps inline command and icon Copy before collapsed manual diagnostics and Delete All', () => {
  const copy = agentEntryMessages('en');
  const request = mcpSetupMessages('en');
  const html = renderAgents(emptySnapshot(), 'en');
  assert.ok(html.includes('data-testid="agents-connection-panel"'));
  assert.ok(html.includes('data-testid="agents-creation-guidance"'));
  assert.ok(html.includes(escaped(copy.agentsConnectionGuide)));
  assert.ok(html.includes(escaped(request.connectionPrompt)));
  assert.ok(html.includes('aria-label="' + escaped(request.copyPrompt) + '"'));
  const details = html.match(/<details\b[^>]*data-testid="agents-connection-details"[^>]*>/);
  assert.ok(details);
  assert.doesNotMatch(details[0], /\bopen(?:=|\s|>)/);
  const copyButton = html.match(
    /<button\b[^>]*data-testid="copy-agent-connection-command"[^>]*>[\s\S]*?<\/button>/,
  );
  assert.ok(copyButton);
  assert.ok(copyButton[0].includes('<svg'));
  assert.ok(!copyButton[0].includes('>' + escaped(copy.agentsCopyCommand) + '<'));
  assert.ok(html.includes(escaped(lanSearchMessages('en').details)));
  assert.ok(html.includes('data-testid="create-agent-manually"'));
  assert.ok(html.includes(escaped(copy.agentsManualDiagnosticLink)));
  assert.ok(html.includes('data-testid="agents-empty"'));
  assert.ok(html.includes(escaped(copy.agentEmptyPrompt)));
  assert.ok(!html.includes(escaped(t('en', 'ariaAddAgent'))));
  const order = [
    'agents-connection-panel',
    'agents-creation-guidance',
    'agent-connection-command',
    'copy-agent-connection-command',
    'agents-connection-details',
    'create-agent-manually',
    'clear-all-local-agents',
    'agents-empty',
  ].map((id) => html.indexOf('data-testid="' + id + '"'));
  assert.ok(order.every((offset, index) => offset >= 0 && (!index || offset > order[index - 1])));
  assert.ok(!html.includes('Codex Desktop'));
  assert.ok(!html.includes('AionUi with Cursor Agent'));
});

test('connection panel does not add an application list and preserves unknown bound-agent status', () => {
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
  assert.ok(html.includes(escaped(copy.agentsConnectionGuide)));
  assert.ok(!html.includes(escaped(copy.agentsCreationConnected.split('{applications}')[0])));
  assert.ok(!html.includes(escaped(copy.agentsCreationNoConnected.split('{applicationsPage}')[0])));
  assert.ok(html.includes('Диагност'));
  assert.ok(html.includes('AionUi'));
  assert.ok(!html.includes(t('ru', 'directoryOnline')));
});

test('connection panel renders the existing localized command and copy action in all 15 locales', () => {
  for (const locale of supportedLocales) {
    const html = renderAgents(emptySnapshot(), locale);
    const command = html.match(
      /<code\b[^>]*data-testid="agent-connection-command"[^>]*>([\s\S]*?)<\/code>/,
    );
    assert.ok(command, locale);
    assert.equal(command[1], escaped(mcpSetupMessages(locale).connectionPrompt), locale);
    assert.ok(html.includes(escaped(agentEntryMessages(locale).agentsConnectionGuide)), locale);
    assert.ok(
      html.includes('aria-label="' + escaped(mcpSetupMessages(locale).copyPrompt) + '"'),
      locale,
    );
    assert.ok(html.includes(escaped(lanSearchMessages(locale).details)), locale);
    assert.ok(
      html.includes(escaped(agentEntryMessages(locale).agentsManualDiagnosticLink)),
      locale,
    );
    assert.ok(html.includes(escaped(t(locale, 'clearAllLocalAgents'))), locale);
  }
});
