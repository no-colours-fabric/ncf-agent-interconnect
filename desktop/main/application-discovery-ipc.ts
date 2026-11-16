import type { BrowserWindow, Dialog } from 'electron';
import { z } from 'zod';
import { ApplicationDiscovery, type DiscoveryOptions } from '../core/application-discovery.js';
import {
  applicationDiscoveryMethods,
  applicationNames,
  type ApplicationDiscoverySnapshot,
} from '../shared/application-discovery.js';
import { mcpSetupClients } from '../shared/mcp-setup.js';
import { ApplicationDiscoveryState } from '../core/application-discovery-state.js';
import { NativeDiscoveryFiles } from '../core/application-discovery-platforms.js';
import { createRequire } from 'node:module';

/** Raw archives need original-fs; never disable ASAR support for the application globally. */
export function createNativeDiscoveryFiles(
  platform: NodeJS.Platform = process.platform,
): NativeDiscoveryFiles {
  const fs = process.versions.electron
    ? (createRequire(import.meta.url)('original-fs') as typeof import('node:fs'))
    : (createRequire(import.meta.url)('node:fs') as typeof import('node:fs'));
  return new NativeDiscoveryFiles(platform, fs.promises);
}

/** The caller must validate the exact owner window and main frame before dispatch. */
export function createApplicationDiscoveryHandler(
  options: DiscoveryOptions & {
    dialog: Pick<Dialog, 'showOpenDialog'>;
    window: () => BrowserWindow | null;
    stateDirectory: string;
  },
) {
  const discovery = new ApplicationDiscovery({
    ...options,
    files: options.files ?? createNativeDiscoveryFiles(options.platform),
  });
  const state = new ApplicationDiscoveryState(options.stateDirectory, options.now);
  let generation = 0;
  let current: Promise<ApplicationDiscoverySnapshot>;
  let servedOwner = '';
  const servedOffers = new Set<string>();
  const refresh = () => {
    const requested = ++generation;
    const scan = discovery.scan().then(async (result): Promise<ApplicationDiscoverySnapshot> => ({
      ...result,
      offers: await state.offers(result.applications),
      stateError: state.error,
    }));
    current = scan.then((value) => (requested === generation ? value : current));
    return current;
  };
  refresh();
  return async (
    method: string,
    raw: unknown,
    owner: string,
  ): Promise<{ handled: false } | { handled: true; result: unknown }> => {
    if (!(applicationDiscoveryMethods as readonly string[]).includes(method))
      return { handled: false };
    if (!owner) throw new Error('The desktop interface session is missing');
    if (servedOwner !== owner) {
      servedOwner = owner;
      servedOffers.clear();
    }
    let result: unknown;
    if (method === 'applicationDiscovery') {
      z.object({}).strict().parse(raw);
      result = await current;
    } else if (method === 'applicationDiscoveryRefresh') {
      z.object({}).strict().parse(raw);
      result = await refresh();
    } else if (method === 'applicationDiscoveryChoose') {
      const { client } = z
        .object({ client: z.enum(mcpSetupClients) })
        .strict()
        .parse(raw);
      const parent = options.window();
      if (!parent || parent.isDestroyed()) throw new Error('The setup window is unavailable');
      const picked = await options.dialog.showOpenDialog(parent, {
        title: 'Select ' + applicationNames[client] + ' installation',
        properties: process.platform === 'darwin' ? ['openFile', 'openDirectory'] : ['openFile'],
      });
      if (!picked.canceled && picked.filePaths[0]) {
        discovery.choose(client, picked.filePaths[0]);
        result = await refresh();
      } else result = await current;
    } else {
      const { clients } = z
        .object({ clients: z.array(z.enum(mcpSetupClients)).min(1).max(5) })
        .strict()
        .parse(raw);
      const parent = options.window();
      if (!parent || parent.isDestroyed() || !parent.isVisible())
        throw new Error('Application offers must be visible in the desktop interface');
      if (clients.some((client) => !servedOffers.has(client)))
        throw new Error('The application offer is no longer available');
      result = { saved: await state.markOffered(clients) };
    }
    if (method !== 'applicationDiscoveryOffered') {
      const snapshot = result as ApplicationDiscoverySnapshot;
      result = {
        ...snapshot,
        offers: await state.offers(snapshot.applications),
        stateError: state.error,
      };
      for (const client of (result as ApplicationDiscoverySnapshot).offers)
        servedOffers.add(client);
    }
    return { handled: true, result };
  };
}
