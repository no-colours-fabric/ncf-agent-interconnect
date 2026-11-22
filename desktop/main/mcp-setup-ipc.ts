import type { BrowserWindow, Dialog } from 'electron';
import { z } from 'zod';
import {
  McpSetupService,
  OpenCodeV2SetupService,
  type McpSetupOptions,
} from '../core/mcp-setup.js';
import { createCodexShortcutHandler } from './codex-shortcut-ipc.js';
import { openCodeV2TargetSchema } from '../core/opencode-v2-auth.js';
import { mcpSetupClients, mcpSetupMethods, openCodeV2SetupMethods } from '../shared/mcp-setup.js';

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
    codexShortcut?: {
      platform: NodeJS.Platform;
      installed: boolean;
      appExecutable: string;
      appPath: string;
      appData: string;
      home: string;
      desktop: string;
      dialog: Pick<Dialog, 'showSaveDialog'>;
    };
  },
): (
  method: string,
  raw: unknown,
  owner: string,
) => Promise<{ handled: false } | { handled: true; result: unknown }> {
  const setup = new McpSetupService(options);
  const v2 = new OpenCodeV2SetupService(options);
  const codexShortcut =
    options.codexShortcut &&
    createCodexShortcutHandler({
      ...options.codexShortcut,
      dialog: {
        showOpenDialog: options.dialog.showOpenDialog,
        showSaveDialog: options.codexShortcut.dialog.showSaveDialog,
      },
      window: options.window,
      status: () => setup.status('codex'),
      codexHome: (options.env ?? process.env).CODEX_HOME,
      configuredFile: (filename) => setup.configuredCodexFile(filename),
    });
  const startupCheck = setup.statusAll().catch(() => undefined);
  return async (method, raw, owner) => {
    if (method === 'codexShortcutPlatform' || method === 'codexShortcutCreate') {
      if (!owner) throw new Error('The desktop interface session is missing');
      return { handled: true, result: codexShortcut ? await codexShortcut(method, raw) : null };
    }
    if ((openCodeV2SetupMethods as readonly string[]).includes(method)) {
      if (!owner) throw new Error('The desktop interface session is missing');
      let result: unknown;
      if (method === 'opencodeV2SetupDefaults') {
        z.object({}).strict().parse(raw);
        result = await v2.v2Defaults();
      } else if (method === 'opencodeV2SetupStatus') {
        const { target } = z
          .object({ target: openCodeV2TargetSchema.optional() })
          .strict()
          .parse(raw);
        result = await v2.v2Status(target);
      } else if (method === 'opencodeV2SetupDiscard') {
        const { planId } = planSchema.parse(raw);
        v2.v2Discard(owner, planId);
        result = { discarded: true };
      } else if (method === 'opencodeV2SetupApply') {
        const { planId, target, confirmReplace } = z
          .object({ planId: z.uuid(), target: openCodeV2TargetSchema, confirmReplace: z.boolean() })
          .strict()
          .parse(raw);
        result = await v2.v2Apply(owner, planId, target, confirmReplace);
      } else {
        const { target } = z.object({ target: openCodeV2TargetSchema }).strict().parse(raw);
        if (method === 'opencodeV2SetupPreview') result = await v2.v2Preview(owner, target);
        else if (method === 'opencodeV2SetupOpen') {
          const error = await options.openPath(await v2.v2Openable(target));
          if (error) throw new Error('The configuration file could not be opened by the system');
          result = { opened: true };
        } else {
          const parent = options.window();
          if (!parent || parent.isDestroyed()) throw new Error('The setup window is unavailable');
          const selected = await options.dialog.showOpenDialog(parent, {
            title: 'Select OpenCode v2 configuration',
            defaultPath: target.configurationPath,
            properties: ['openFile', 'showHiddenFiles'],
            filters: [
              { name: 'Configuration', extensions: ['json', 'jsonc'] },
              { name: 'All files', extensions: ['*'] },
            ],
          });
          result =
            selected.canceled || !selected.filePaths[0]
              ? null
              : await v2.canonicalTarget({ ...target, configurationPath: selected.filePaths[0] });
        }
      }
      return { handled: true, result };
    }
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
            claude: 'Claude Code',
          }[client] +
          ' configuration',
        defaultPath,
        properties: ['openFile', 'showHiddenFiles'],
        filters: [
          {
            name: 'Configuration',
            extensions:
              client === 'codex' ? ['toml'] : client === 'claude' ? ['json'] : ['json', 'jsonc'],
          },
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
