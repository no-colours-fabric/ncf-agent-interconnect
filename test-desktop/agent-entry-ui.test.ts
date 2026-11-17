import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { AgentsPage } from '../desktop/renderer/AgentsPage.js';
import { agentEntryMessages } from '../desktop/renderer/i18n/agent-entry.js';
import { t } from '../desktop/renderer/i18n/index.js';
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

function renderAgents(snapshot: Snapshot, locale: 'en' | 'ru'): string {
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

test('agents page replaces the primary add action with guidance and a diagnostic link', () => {
  const copy = agentEntryMessages('en');
  const html = renderAgents(emptySnapshot(), 'en');
  assert.ok(html.includes('data-testid="agents-creation-guidance"'));
  assert.ok(html.includes(escaped(copy.agentsCreationNoConnected.split('{applicationsPage}')[0])));
  assert.ok(html.includes('Codex Desktop'));
  assert.ok(html.includes('Claude Code'));
  assert.ok(html.includes('AionUi with Cursor Agent'));
  assert.ok(html.includes('data-testid="create-agent-manually"'));
  assert.ok(html.includes(escaped(copy.agentsManualDiagnosticLink)));
  assert.ok(html.includes('data-testid="agents-empty"'));
  assert.ok(html.includes(escaped(copy.agentEmptyPrompt)));
  assert.ok(!html.includes(escaped(t('en', 'ariaAddAgent'))));
});

test('bound applications are listed as configured without claiming unknown presence is ready', () => {
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
  assert.ok(html.includes(escaped(copy.agentsCreationConnected.split('{applications}')[0])));
  assert.ok(html.includes(escaped(copy.aionUiApplication)));
  assert.ok(!html.includes(escaped(copy.agentsCreationNoConnected.split('{applicationsPage}')[0])));
  assert.ok(!html.includes(t('ru', 'directoryOnline')));
});
