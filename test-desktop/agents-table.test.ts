import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  agentRows,
  sortAgentRows,
  type AgentRow,
  type AgentSortColumn,
} from '../desktop/renderer/agents-table-model.js';
import { agentRenameMessages } from '../desktop/renderer/i18n/agent-rename.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';
import { AgentsTable, type AgentsTableLabels } from '../desktop/renderer/AgentsTable.js';
import { RemoteNodesTable } from '../desktop/renderer/RemoteNodesTable.js';
import type { Snapshot } from '../desktop/shared/contracts.js';

function fixture(): Snapshot {
  const nodeId = randomUUID(),
    remote = randomUUID();
  return {
    running: true,
    nodeId,
    nodeLabel: 'Local',
    mcpUrl: '',
    peerUrl: '',
    listenHost: '127.0.0.1',
    localAddresses: [],
    adapters: [],
    exportRoots: [],
    errors: [],
    peers: [
      {
        id: remote,
        label: 'Remote',
        address: 'wss://fixture.invalid/peer',
        activeAddress: 'wss://active.fixture.invalid/peer',
        connected: true,
        error: null,
      },
    ],
    agents: [
      {
        nickname: 'Агент <&>',
        key: 'агент <&>',
        binding: null,
        unread: 2,
        messageCount: 5,
        incomingCount: 3,
        outgoingCount: 2,
        lastMessageAt: '2026-11-01T12:00:00.000Z',
      },
    ],
    directories: [
      {
        nodeId,
        nodeLabel: 'Local',
        local: true,
        state: 'ready',
        epoch: randomUUID(),
        revision: 1,
        updatedAt: null,
        total: 1,
        truncated: false,
        agents: [{ nickname: 'АГЕНТ <&>', availability: 'online', delivery: 'mcp' }],
      },
      {
        nodeId: remote,
        nodeLabel: 'Remote',
        local: false,
        state: 'ready',
        epoch: randomUUID(),
        revision: 1,
        updatedAt: '2026-11-01T12:00:00.000Z',
        total: 1,
        truncated: false,
        agents: [{ nickname: 'Агент <&>', availability: 'unknown', delivery: 'unknown' }],
      },
    ],
  };
}
const labels: AgentsTableLabels = {
  name: 'Name',
  client: 'Application',
  node: 'Node',
  lastMessage: 'Last message',
  incoming: 'In',
  outgoing: 'Out',
  actions: 'Actions',
  chat: (name) => 'Chat ' + name,
  rename: 'Rename agent',
  remove: (name) => 'Delete ' + name,
  remoteRemoval: 'Delete on remote node',
};

test('one message column distinguishes measured zeros from unknown directional and remote counts', () => {
  const snapshot = fixture();
  const render = () =>
    renderToStaticMarkup(
      createElement(AgentsTable, {
        rows: agentRows(snapshot),
        labels,
        locale: 'en',
        nodeName: () => 'Machine',
        onChat: () => {},
        onDelete: () => {},
        onRename: () => {},
      }),
    );
  const messageCells = (html: string) =>
    [...html.matchAll(/<tr\b[^>]*data-testid="agent-row"[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
      return cells[4][1]
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s/g, '');
    });
  assert.deepEqual(messageCells(render()).sort(), ['', '532']);
  snapshot.agents[0].messageCount = 0;
  snapshot.agents[0].incomingCount = 0;
  snapshot.agents[0].outgoingCount = 0;
  assert.deepEqual(messageCells(render()).sort(), ['', '000']);
  snapshot.agents[0].incomingCount = undefined;
  assert.deepEqual(messageCells(render()).sort(), ['', '0']);
});

test('same Unicode name on different nodes keeps separate rows and only confirmed availability gets an icon', () => {
  const snapshot = fixture();
  const rows = agentRows(snapshot);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(rows.find((row) => row.local)?.online, true);
  const remote = rows.find((row) => !row.local)!;
  assert.equal(remote.online, false);
  assert.equal(remote.incomingCount, undefined);
  assert.equal(remote.messageCount, undefined);
  assert.equal(remote.outgoingCount, undefined);
  assert.equal(remote.lastMessageAt, undefined);
  assert.equal(remote.client, undefined);
  const html = renderToStaticMarkup(
    createElement(AgentsTable, {
      rows,
      labels,
      locale: 'en',
      nodeName: () => 'Machine',
      onChat: () => assert.fail(),
      onDelete: () => assert.fail(),
      onRename: () => assert.fail(),
    }),
  );
  assert.equal((html.match(/data-testid="agent-online"/g) ?? []).length, 1);
  assert.equal((html.match(/data-testid="agent-row"/g) ?? []).length, 2);
  assert.equal((html.match(/data-testid="agent-node-kind"/g) ?? []).length, 2);
  assert.ok(html.includes('aria-label="Remote agents"'));
  assert.ok(html.includes('Агент &lt;&amp;&gt;'));
  assert.ok(!html.includes('Client availability unknown'));
  assert.ok(!html.includes('Offline'));
  assert.ok(html.includes('disabled=""'));
  assert.match(html, /<button[^>]+type="button"[^>]*>Messages/);
  assert.match(html, /<th\b(?=[^>]*scope="col")(?=[^>]*aria-sort="ascending")/);
  assert.equal((html.match(/aria-sort=/g) ?? []).length, 1);
  assert.ok(!html.includes('>In</th>'));
  assert.ok(!html.includes('>Out</th>'));
  assert.ok(html.includes('aria-label="In: 3"'));
  assert.ok(html.includes('aria-label="Out: 2"'));
  assert.ok(html.includes('data-testid="ArrowDownwardOutlinedIcon"'));
  assert.ok(html.includes('data-testid="ArrowUpwardOutlinedIcon"'));
  snapshot.running = false;
  assert.ok(agentRows(snapshot).every((row) => !row.online));
  snapshot.running = true;
  snapshot.directories[0].state = 'offline';
  snapshot.directories[1].state = 'syncing';
  snapshot.directories[1].agents[0].availability = 'online';
  assert.ok(agentRows(snapshot).every((row) => !row.online));
});

test('all data columns sort in both directions and keep missing values last', () => {
  const base = { local: true, online: false };
  const rows: AgentRow[] = [
    {
      ...base,
      id: 'a',
      nickname: 'Agent 10',
      nodeId: 'a',
      application: 'cursor-hook',
      lastMessageAt: '2025-01-02T01:00:00+02:00',
      messageCount: 12,
    },
    {
      ...base,
      id: 'b',
      nickname: 'Agent 2',
      nodeId: 'b',
      application: 'codex-desktop',
      lastMessageAt: '2025-01-02T00:00:00Z',
      messageCount: 0,
    },
    { ...base, id: 'c', nickname: 'Agent 3', nodeId: 'c', lastMessageAt: 'invalid' },
  ];
  const nodeNames = new Map([
    ['a', 'Node 2'],
    ['b', 'Node 10'],
  ]);
  const nodeName = (id: string) => nodeNames.get(id) ?? '';
  const applicationName = (id: string) => (id === 'cursor-hook' ? 'Cursor' : 'ChatGPT');
  const cases: [AgentSortColumn, string[], string[]][] = [
    ['name', ['b', 'c', 'a'], ['a', 'c', 'b']],
    ['application', ['b', 'a', 'c'], ['a', 'b', 'c']],
    ['node', ['a', 'b', 'c'], ['b', 'a', 'c']],
    ['lastMessage', ['a', 'b', 'c'], ['b', 'a', 'c']],
    ['messages', ['b', 'a', 'c'], ['a', 'b', 'c']],
  ];
  for (const [column, asc, desc] of cases) {
    for (const [direction, expected] of [
      ['asc', asc],
      ['desc', desc],
    ] as const) {
      assert.deepEqual(
        sortAgentRows(rows, { column, direction }, 'en', nodeName, applicationName).map(
          (row) => row.id,
        ),
        expected,
        column + ' ' + direction,
      );
    }
  }
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'b', 'c'],
  );
});

test('the application column renders the paired node’s own app and a localized legacy fallback', () => {
  const snapshot = fixture();
  const local = snapshot.agents[0];
  const adapterId = randomUUID();
  local.binding = {
    connectionId: randomUUID(),
    adapterId,
    chatId: randomUUID(),
    client: 'Codex',
    generation: 1,
  };
  snapshot.adapters.push({
    id: adapterId,
    label: 'Private adapter label',
    kind: 'codex-desktop',
    state: 'ready',
    capabilities: { exactSession: true, wakeIdle: true, receiveActive: true, nativeDisplay: true },
    error: null,
  });
  const remote = snapshot.directories[1];
  const older = {
    ...remote,
    nodeId: randomUUID(),
    agents: [{ ...remote.agents[0] }],
  };
  remote.agents[0].application = 'opencode-v2';
  snapshot.directories.push(older);
  const rows = agentRows(snapshot);
  assert.equal(rows.find((row) => row.local)?.application, 'codex-desktop');
  assert.equal(rows.find((row) => row.nodeId === remote.nodeId)?.application, 'opencode-v2');
  assert.equal(rows.find((row) => row.nodeId === older.nodeId)?.application, undefined);
  for (const locale of supportedLocales) {
    const html = renderToStaticMarkup(
      createElement(AgentsTable, {
        rows,
        labels: { ...labels, client: t(locale, 'agentsColumnClient') },
        locale,
        nodeName: (nodeId) => nodeId,
        onChat: () => assert.fail(),
        onDelete: () => assert.fail(),
        onRename: () => assert.fail(),
      }),
    );
    const cells = [...html.matchAll(/<tr\b[^>]*data-testid="agent-row"[^>]*>([\s\S]*?)<\/tr>/g)];
    assert.equal(cells.length, 3, locale);
    for (const [nodeId, name] of [
      [snapshot.nodeId, 'ChatGPT'],
      [remote.nodeId, 'OpenCode v2'],
    ]) {
      const row = cells.find((cell) => cell[0].includes('data-agent-id="' + nodeId + ':'));
      assert.ok(row?.[1].includes(name), locale);
      assert.match(row![1], /<img[^>]+alt=""/);
    }
    const legacy = cells.find((cell) => cell[0].includes('data-agent-id="' + older.nodeId + ':'));
    assert.ok(legacy?.[1].includes(t(locale, 'agentsApplicationUnknown')), locale);
    assert.doesNotMatch(legacy![1], /<img\b/);
    assert.ok(!html.includes('Private adapter label'), locale);
  }
});

test('remote nodes table reports counts and update time without exposing agent lists or invented counts', () => {
  const snapshot = fixture();
  const render = () =>
    renderToStaticMarkup(
      createElement(RemoteNodesTable, { snapshot, locale: 'en', nodeName: () => 'Remote machine' }),
    );
  const html = render();
  assert.ok(html.includes('>1</td>'));
  assert.ok(html.includes('>wss://active.fixture.invalid/peer</td>'));
  assert.ok(!html.includes('wss://fixture.invalid/peer'));
  assert.ok(!html.includes('Агент'));
  snapshot.directories[1].epoch = null;
  snapshot.directories[1].state = 'unsupported';
  const unknown = render();
  assert.ok(!unknown.includes('>0</td>'));
  assert.ok(!unknown.includes('>1</td>'));
});

test('the renamed local agent keeps its table identity, matches directory presence and has the only rename action', () => {
  const snapshot = fixture();
  const original = agentRows(snapshot).find((agent) => agent.local)!;
  snapshot.agents[0].incarnation = randomUUID();
  snapshot.agents[0].nickname = 'Éditeur';
  snapshot.directories[0].agents[0].nickname = 'E\u0301DITEUR';
  const rows = agentRows(snapshot);
  const renamed = rows.find((agent) => agent.local)!;
  assert.equal(renamed.id, original.id);
  assert.equal(renamed.online, true);
  assert.equal(renamed.nickname, 'Éditeur');
  for (const locale of supportedLocales) {
    const copy = agentRenameMessages[locale];
    assert.ok(Object.values(copy).every((value) => value.trim()));
    const html = renderToStaticMarkup(
      createElement(AgentsTable, {
        rows,
        labels: { ...labels, rename: copy.title },
        locale,
        nodeName: () => 'Machine',
        onChat: () => assert.fail(),
        onDelete: () => assert.fail(),
        onRename: () => assert.fail(),
      }),
    );
    assert.equal((html.match(/data-testid="rename-local-agent"/g) ?? []).length, 1);
    assert.ok(html.includes('aria-label="' + copy.title + '"'));
  }
});
