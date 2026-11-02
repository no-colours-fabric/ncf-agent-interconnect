import type { BrowserWindow, Dialog } from 'electron';
import { z } from 'zod';
import { McpSetupService, type McpSetupOptions } from '../core/mcp-setup.js';
import { mcpSetupClients, mcpSetupMethods } from '../shared/mcp-setup.js';

const clientSchema = z.enum(mcpSetupClients);
const targetSchema = z
  .object({ id: z.literal('configuration'), path: z.string().min(1).max(8192) })
  .strict();
const planSchema = z.object({ planId: z.uuid() }).strict();

/** Call only after validating the sender and main frame in the existing UI IPC boundary. */
export function createMcpSetupHandler(
  options: McpSetupOptions & {
    dialog: Pick<Dialog, 'showOpenDialog'>;
    window: () => BrowserWindow | null;
    openPath: (filename: string) => Promise<string>;
  },
): (
  method: string,
  raw: unknown,
  owner: string,
) => Promise<{ handled: false } | { handled: true; result: unknown }> {
  const setup = new McpSetupService(options);
  const startupCheck = setup.statusAll().catch(() => undefined);
  return async (method, raw, owner) => {
    if (!(mcpSetupMethods as readonly string[]).includes(method)) return { handled: false };
    if (!owner) throw new Error('The desktop interface session is missing');
    let result: unknown;
    if (method === 'mcpSetupStatus') {
      const { client } = z.object({ client: clientSchema }).strict().parse(raw);
      await startupCheck;
      result = await setup.status(client);
    } else if (method === 'mcpSetupOpen') {
      const { client } = z.object({ client: clientSchema }).strict().parse(raw);
      const error = await options.openPath(await setup.openablePath(client));
      if (error) throw new Error('The configuration file could not be opened by the system');
      result = { opened: true };
    } else if (method === 'mcpSetupDefaults') {
      const { client } = z.object({ client: clientSchema }).strict().parse(raw);
      result = await setup.defaults(client);
    } else if (method === 'mcpSetupBrowse') {
      const { client, path } = z
        .object({ client: clientSchema, path: z.string().max(8192) })
        .strict()
        .parse(raw);
      const parent = options.window();
      if (!parent || parent.isDestroyed()) throw new Error('The setup window is unavailable');
      let defaultPath = (await setup.defaults(client)).files[0].path;
      if (path) {
        try {
          defaultPath = setup.resolvePath(path);
        } catch {
          /* Keep the known location when an edited path is incomplete. */
        }
      }
      const selected = await options.dialog.showOpenDialog(parent, {
        title:
          'Select ' +
          {
            cursor: 'Cursor',
            opencode: 'OpenCode v1',
            codex: 'Codex',
            aionui: 'Cursor Agent in AionUi',
          }[client] +
          ' configuration',
        defaultPath,
        properties: ['openFile', 'showHiddenFiles'],
        filters: [
          { name: 'Configuration', extensions: client === 'codex' ? ['toml'] : ['json', 'jsonc'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });
      result = selected.canceled ? null : (selected.filePaths[0] ?? null);
    } else if (method === 'mcpSetupPreview') {
      const { client, files } = z
        .object({ client: clientSchema, files: z.array(targetSchema).length(1) })
        .strict()
        .parse(raw);
      result = await setup.preview(owner, client, files);
    } else if (method === 'mcpSetupApply') {
      const { planId, confirmReplace } = planSchema
        .extend({ confirmReplace: z.boolean() })
        .parse(raw);
      result = await setup.apply(owner, planId, confirmReplace);
    } else {
      const { planId } = planSchema.parse(raw);
      setup.discard(owner, planId);
      result = { discarded: true };
    }
    return { handled: true, result };
  };
}
