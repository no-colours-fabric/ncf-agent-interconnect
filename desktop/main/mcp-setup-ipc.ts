import path from 'node:path';
import type { DesktopSessionDelivery, DeliveryAction } from '../shared/desktop-session-delivery.js';
import type { BrowserWindow, Dialog } from 'electron';
import { z } from 'zod';
import {
  McpSetupService,
  OpenCodeV2SetupService,
  type McpSetupOptions,
} from '../core/mcp-setup.js';
import { macSetupConfigurations, macShortcutDirectory } from './codex-shortcut-mac.js';
import { McpSetupPaths } from '../core/mcp-setup-paths.js';
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
    macSetupProfiles?: () => Promise<string[] | undefined>;
    createDesktopDelivery?: (
      selected: () => Promise<string | null>,
    ) => (action: DeliveryAction, expected?: string) => Promise<DesktopSessionDelivery>;
    codexShortcut?: {
      platform: NodeJS.Platform;
      installed: boolean;
      alternateUserData: boolean;
      userData: string;
      appExecutable: string;
      appPath: string;
      appData: string;
      home: string;
      desktop: string;
      boundProfiles: () => readonly { socket?: string; codexQueue?: boolean }[];
      reveal: (filename: string) => void;
      dialog: Pick<Dialog, 'showOpenDialog'>;
    };
  },
): (
  method: string,
  raw: unknown,
  owner: string,
) => Promise<{ handled: false } | { handled: true; result: unknown }> {
  const setup = new McpSetupService(options);
  const v2 = new OpenCodeV2SetupService(options);
  const paths = new McpSetupPaths(options.stateDirectory);
  const desktop = options.codexShortcut;
  const macProfiles =
    options.macSetupProfiles ??
    (desktop?.platform === 'darwin'
      ? () => macSetupConfigurations(desktop.appPath, desktop.home, desktop.appData)
      : undefined);

  async function quickProfiles() {
    const saved = await paths.get('codex');
    if (saved) return { configurations: [saved], choose: false };
    const running = await macProfiles?.();
    if (running?.length) return { configurations: running, choose: running.length > 1 };
    const defaults = (await setup.defaults('codex')).files[0];
    if (!macProfiles) return { configurations: [defaults.path], choose: false };

    // Discovery was inconclusive. Offer known locations for an explicit selection.
    const candidates = new Set(defaults.alternatives);
    for (const { socket } of desktop?.boundProfiles() ?? []) {
      if (!socket || !path.isAbsolute(socket)) continue;
      const parent = path.dirname(socket);
      if (
        !(path.basename(parent) === 'ipc' && path.basename(socket) === 'ipc.sock') &&
        !(
          path.basename(parent) === 'app-server-control' &&
          path.basename(socket) === 'app-server-control.sock'
        )
      )
        continue;
      const profile = path.dirname(parent);
      if ((await macShortcutDirectory(profile).catch(() => null)) === profile)
        candidates.add(path.join(profile, 'config.toml'));
    }
    return { configurations: [...candidates], choose: !running || candidates.size > 1 };
  }
  const desktopDelivery = options.createDesktopDelivery?.(async () => {
    const remembered = await paths.get('codex');
    const targets = remembered ? undefined : await quickProfiles();
    const selected = remembered ?? (targets && !targets.choose ? targets.configurations[0] : null);
    const configured = selected && (await setup.configuredCodexFile(selected));
    return configured ? path.dirname(configured) : null;
  });
  const startupCheck = setup.statusAll().catch(() => undefined);
  return async (method, raw, owner) => {
    if (method === 'desktopSessionDelivery') {
      if (!owner) throw new Error('The desktop interface session is missing');
      const request = z
        .discriminatedUnion('action', [
          z.object({ action: z.literal('status') }).strict(),
          z.object({ action: z.literal('enable'), profile: z.string().min(1).max(8192) }).strict(),
          z.object({ action: z.literal('disable'), profile: z.string().min(1).max(8192) }).strict(),
        ])
        .parse(raw);
      const result = desktopDelivery
        ? await desktopDelivery(request.action, 'profile' in request ? request.profile : undefined)
        : { state: 'unsupported' };
      return { handled: true, result };
    }
    if (method === 'codexSetupPrepare') {
      if (!owner) throw new Error('The desktop interface session is missing');
      const { configuration } = z
        .object({ configuration: z.string().min(1).max(8192).optional() })
        .strict()
        .parse(raw);
      const { configurations, choose } = await quickProfiles();
      if (configuration ? !configurations.includes(configuration) : choose)
        return { handled: true, result: { configurations } };
      return {
        handled: true,
        result: await setup.preview(owner, 'codex', [
          { id: 'configuration', path: configuration ?? configurations[0] },
        ]),
      };
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
      const status = await setup.status(client);
      if (client === 'codex' && status.state === 'configured') {
        const { configurations, choose } = await quickProfiles();
        const delivery = await desktopDelivery?.('status').catch(
          () => ({ state: 'unavailable' }) as const,
        );
        if (
          choose ||
          configurations[0] !== status.files[0]?.path ||
          (delivery &&
            delivery.state !== 'unsupported' &&
            !(
              delivery.state === 'enabled' &&
              delivery.profile === path.dirname(status.files[0].path)
            ))
        )
          status.codexConnectRequired = true;
      }
      result = status;
    } else if (method === 'mcpSetupOpen') {
      const { client } = z.object({ client: clientSchema }).strict().parse(raw);
      const error = await options.openPath(await setup.openablePath(client));
      if (error) throw new Error('The configuration file could not be opened by the system');
      result = { opened: true };
    } else if (method === 'mcpSetupDefaults') {
      const { client } = z.object({ client: clientSchema }).strict().parse(raw);
      const defaults = await setup.defaults(client);
      if (client === 'codex' && macProfiles) {
        const running = await macProfiles();
        const file = defaults.files[0];
        file.alternatives = [...new Set([...file.alternatives, ...(running ?? [])])];
      }
      result = defaults;
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
            codex: 'ChatGPT',
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
