import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { agentRows } from '../desktop/renderer/agents-table-model.js';
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
  client: 'Client',
  node: 'Node',
  lastMessage: 'Last message',
  incoming: 'In',
  outgoing: 'Out',
  actions: 'Actions',
  chat: (name) => 'Chat ' + name,
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
      }),
    );
  const messageCells = (html: string) =>
    [...html.matchAll(/<tr\b[^>]*data-testid="agent-row"[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
      return cells[3][1]
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s/g, '');
    });
  assert.deepEqual(messageCells(render()).sort(), ['', '5(3/2)']);
  snapshot.agents[0].messageCount = 0;
  snapshot.agents[0].incomingCount = 0;
  snapshot.agents[0].outgoingCount = 0;
  assert.deepEqual(messageCells(render()).sort(), ['', '0(0/0)']);
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
    }),
  );
  assert.equal((html.match(/data-testid="agent-online"/g) ?? []).length, 1);
  assert.equal((html.match(/data-testid="agent-row"/g) ?? []).length, 2);
  assert.ok(html.includes('Агент &lt;&amp;&gt;'));
  assert.ok(!html.includes('Client availability unknown'));
  assert.ok(!html.includes('Offline'));
  assert.ok(html.includes('disabled=""'));
  assert.ok(html.includes('>Messages</th>'));
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

test('remote nodes table reports counts and update time without exposing agent lists or invented counts', () => {
  const snapshot = fixture();
  const render = () =>
    renderToStaticMarkup(
      createElement(RemoteNodesTable, { snapshot, locale: 'en', nodeName: () => 'Remote machine' }),
    );
  const html = render();
  assert.ok(html.includes('>1</td>'));
  assert.ok(html.includes('wss://fixture.invalid/peer'));
  assert.ok(!html.includes('Агент'));
  snapshot.directories[1].epoch = null;
  snapshot.directories[1].state = 'unsupported';
  const unknown = render();
  assert.ok(!unknown.includes('>0</td>'));
  assert.ok(!unknown.includes('>1</td>'));
});
