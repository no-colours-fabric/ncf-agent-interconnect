import type { BrowserWindow, Dialog } from 'electron';
import { z } from 'zod';
import { ApplicationDiscovery, type DiscoveryOptions } from '../core/application-discovery.js';
import {
  applicationDiscoveryMethods,
  applicationNames,
  type ApplicationDiscoverySnapshot,
} from '../shared/application-discovery.js';
import { mcpSetupClients } from '../shared/mcp-setup.js';

/** The caller must validate the exact owner window and main frame before dispatch. */
export function createApplicationDiscoveryHandler(
  options: DiscoveryOptions & {
    dialog: Pick<Dialog, 'showOpenDialog'>;
    window: () => BrowserWindow | null;
  },
) {
  const discovery = new ApplicationDiscovery(options);
  let generation = 0;
  let current: Promise<ApplicationDiscoverySnapshot>;
  const refresh = () => {
    const requested = ++generation;
    const scan = discovery.scan().then((result): ApplicationDiscoverySnapshot => ({
      ...result,
      offers: [],
      stateError: false,
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
      throw new Error('Application offers are unavailable');
    }
    return { handled: true, result };
  };
}
