import { mkdtemp, rm } from 'node:fs/promises';
import type { Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { NodeService } from '../desktop/core/service.js';
import { SettingsFile } from '../desktop/core/settings.js';
import { withDeadline } from './pairing-harness.js';

/** Every handle here belongs to this isolated fixture, never a working hub. */
export async function pairingNode(
  t: { after(callback: () => Promise<void>): unknown },
  nodeId?: string,
): Promise<NodeService> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-pair-node-'));
  let service: NodeService | undefined;
  const sockets = new Set<Socket>();
  t.after(async () => {
    const errors: unknown[] = [];
    if (service?.store) {
      const closing = service.close();
      try {
        await withDeadline(closing, 5000, 'Pairing node cleanup');
      } catch (error) {
        errors.push(error);
        // A cleanup timeout is still a test failure. Only reap this fixture's sockets.
        for (const socket of sockets) socket.destroy();
        const server = service.network?.server;
        if (server?.listening) server.close(() => {});
        server?.closeAllConnections();
        try {
          await withDeadline(closing, 5000, 'Forced pairing node cleanup');
        } catch (forcedError) {
          errors.push(forcedError);
        }
      }
    }
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Pairing fixture cleanup failed');
  });
  const file = new SettingsFile(directory);
  await file.load();
  if (nodeId) file.value.nodeId = nodeId;
  file.value.peerPort = 0;
  await file.save();
  service = new NodeService(directory);
  await withDeadline(service.open(), 10000, 'Pairing node startup');
  service.network.server!.on('connection', (socket: Socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  return service;
}
