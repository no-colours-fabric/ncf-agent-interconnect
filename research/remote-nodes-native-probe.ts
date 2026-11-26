import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { NodeService } from '../desktop/core/service.js';
import { SettingsFile } from '../desktop/core/settings.js';
import { udpLanTransport } from '../desktop/core/lan-discovery.js';
import type { OutgoingPairApproval } from '../desktop/shared/pairing-approval.js';

const [side, appRevision = 'unspecified'] = process.argv.slice(2);
if (side !== 'Mac' && side !== 'Windows') throw new Error('Specify Mac or Windows.');
const label = 'NCF #11 ' + side;
const other = 'NCF #11 ' + (side === 'Mac' ? 'Windows' : 'Mac');
const group = { group: '239.255.73.137', port: 47337 };
const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-11-native-'));
const print = (data: object) => console.log(JSON.stringify(data));
const fault = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : 'unclassified';
};
const clear = () => ({
  starts: 0,
  transportFaults: [] as string[],
  queriesIn: 0,
  queriesOut: 0,
  directQueriesIn: 0,
  directQueriesOut: 0,
  otherAnnouncesIn: 0,
  announcesOut: 0,
  unicastRepliesOut: 0,
  otherObserved: 0,
});
let counters = clear();
let requestId: string | undefined;
let previousPeerId: string | undefined;
let searchTimers: NodeJS.Timeout[] = [];
const packet = (data: Uint8Array): { type?: string; label?: string } | undefined => {
  try {
    return JSON.parse(Buffer.from(data).toString());
  } catch {
    return undefined;
  }
};
let read: ReturnType<typeof createInterface> | undefined;
const app = new NodeService(directory, {
  codexSockets: () => [],
  lanDiscovery: {
    transport(interfaces) {
      const transport = udpLanTransport(interfaces, group);
      return {
        async start(handlers) {
          counters.starts++;
          try {
            await transport.start({
              failed(error) {
                counters.transportFaults.push(fault(error));
                handlers.failed();
              },
              message(data, source) {
                const value = packet(data);
                if (value?.type === 'query') counters.queriesIn++;
                if (value?.type === 'direct-query') counters.directQueriesIn++;
                if (value?.type === 'announce' && value.label === other)
                  counters.otherAnnouncesIn++;
                handlers.message(data, source);
              },
            });
          } catch (error) {
            counters.transportFaults.push(fault(error));
            throw error;
          }
        },
        send(data, interfaceAddress, recipientAddress) {
          const value = packet(data);
          if (value?.type === 'query') counters.queriesOut++;
          if (value?.type === 'direct-query') counters.directQueriesOut++;
          if (value?.type === 'announce') counters.announcesOut++;
          if (recipientAddress) counters.unicastRepliesOut++;
          transport.send(data, interfaceAddress, recipientAddress);
        },
        stop: () => transport.stop(),
      };
    },
    observed(node) {
      if (node.label === other) counters.otherObserved++;
    },
  },
});
const get = () => app.snapshot({ lanDiscovery: true });
const summary = (stage: string) => {
  const snapshot = get();
  const peer = snapshot.peers.find((current) => current.label === other);
  previousPeerId ??= peer?.id;
  const search = snapshot.lanSearch;
  print({
    stage,
    peer: peer?.connected ? 'connected' : peer ? 'paired' : 'unpaired',
    disconnectSeen: snapshot.peerDisconnection?.id === previousPeerId && !!previousPeerId,
    phase: search?.phase,
    reason: search?.reason,
    run: search?.runId,
    otherFoundThisRun: search?.nodes.some(
      (node) =>
        node.label === other &&
        (node.observedInRun || node.endpoints?.some((e) => e.observedInRun)),
    ),
    ...counters,
  });
};
const command = async (line: string) => {
  const [action, value, expectedNodeId] = line.trim().split(/\s+/);
  if (!action) return;
  if (action === 'status') summary('status');
  else if (action === 'zero') counters = clear();
  else if (action === 'inventory') {
    const snapshot = get().networkInterfaces!;
    print({
      interfaces: snapshot.interfaces.map((entry) => ({
        ipv4: entry.addresses.map(({ internal, prefixLength }) => ({
          internal,
          prefixLength,
        })),
        excluded: entry.excluded,
      })),
      listeners: app.network.endpoints.length,
    });
  } else if (action === 'endpoint') {
    const selected = app.network.endpoints[Number(value)];
    if (!selected) throw new Error('Select an endpoint index.');
    // This one explicit command displays a temporary address for a private handoff.
    print({
      endpoint: 'wss://' + selected.address + ':' + selected.port + '/peer',
      nodeId: get().nodeId,
    });
  } else if (action === 'request') {
    if (!value || !expectedNodeId || requestId)
      throw new Error('Use an exact test endpoint and ID.');
    requestId = randomUUID();
    try {
      const state = (await app.userCall('requestPeerApproval', {
        id: requestId,
        address: value,
        expectedNodeId,
      })) as OutgoingPairApproval;
      print({ request: state.state });
      if (state.state !== 'waiting' && state.state !== 'shown') requestId = undefined;
    } catch (error) {
      requestId = undefined;
      throw error;
    }
  } else if (action === 'approve') {
    const incoming = app.network.approvalHost.next();
    if (incoming?.label !== other || !app.network.approvalHost.displayed(incoming.id))
      throw new Error('No request from the expected test instance.');
    await app.network.approvalHost.decide(incoming.id, 'confirm');
    print({ approved: true });
  } else if (action === 'progress') {
    if (!requestId) throw new Error('No test request is active.');
    const state = (await app.userCall('peerApprovalProgress', {
      id: requestId,
    })) as OutgoingPairApproval;
    print({ request: state.state });
    if (state.state !== 'waiting' && state.state !== 'shown') requestId = undefined;
  } else if (action === 'confirm-baseline') {
    if (!requestId) throw new Error('No test request is active.');
    print({ legacy: await app.userCall('confirmPeerApproval', { id: requestId }) });
  } else if (action === 'disconnect') {
    const peer = get().peers.find((current) => current.label === other && current.connected);
    if (!peer?.removalToken) throw new Error('Expected test peer is not connected.');
    previousPeerId = peer.id;
    await app.userCall('removePeer', { nodeId: peer.id, token: peer.removalToken });
    summary('disconnect');
  } else if (action === 'search') {
    searchTimers.forEach(clearTimeout);
    print({ search: await app.userCall('startLanSearch', {}) });
    summary('search +0s');
    searchTimers = [10000, 30050].map((ms) =>
      setTimeout(() => summary('search +' + Math.round(ms / 1000) + 's'), ms),
    );
  } else {
    print({
      commands:
        'inventory, endpoint INDEX, status, zero, request URL NODE_ID, approve, progress, confirm-baseline, disconnect, search, quit',
    });
  }
};

try {
  const settings = new SettingsFile(directory);
  await settings.load();
  settings.value.nodeLabel = label;
  settings.value.peerPort = 0;
  settings.value.mcpPort = 0;
  await settings.save();
  await app.open();
  print({
    ready: side,
    revision: appRevision,
    os: os.platform(),
    osRelease: os.release(),
    node: process.version,
  });
  read = createInterface({ input: process.stdin });
  for await (const line of read) {
    if (line.trim() === 'quit') break;
    try {
      await command(line);
    } catch (error) {
      print({ action: line.trim().split(/\s+/)[0], failed: fault(error) });
    }
  }
} finally {
  searchTimers.forEach(clearTimeout);
  read?.close();
  try {
    if (app.store) await app.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
