import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { applyEdits, modify, parse, parseTree, type Node, type ParseError } from 'jsonc-parser';
import { parse as parseToml, patch as patchToml } from '@decimalturn/toml-patch';
import type { McpSetupClient, McpSetupFilePreview } from '../shared/mcp-setup.js';
import { claudeToolPrefix } from '../integrations/claude-code.js';
import { claudeSetupAllowRules } from './instructions.js';

const serverName = 'ncf_agent_interconnect';
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value: Record<string, unknown>, key: string) =>
  Object.hasOwn(value, key) ? value[key] : undefined;
function containsSettings(current: unknown, required: unknown): boolean {
  if (!object(current) || !object(required)) return isDeepStrictEqual(current, required);
  return Object.entries(required).every(
    ([key, value]) => Object.hasOwn(current, key) && containsSettings(current[key], value),
  );
}
function json(text: string): Record<string, unknown> {
  const errors: ParseError[] = [];
  const input = text.trim() ? text : '{}';
  const value: unknown = parse(input, errors, { allowTrailingComma: true });
  if (errors.length || !object(value))
    throw new Error('The configuration is not a valid JSON object');
  const checkKeys = (node: Node): void => {
    if (node.type === 'object') {
      const keys = new Set<string>();
      for (const property of node.children ?? []) {
        const key = property.children![0].value as string;
        if (keys.has(key)) throw new Error('The configuration contains duplicate object keys');
        keys.add(key);
      }
    }
    for (const child of node.children ?? []) checkKeys(child);
  };
  checkKeys(parseTree(input, [], { allowTrailingComma: true })!);
  return value;
}
function table(root: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = own(root, key);
  if (value === undefined) return {};
  if (!object(value)) throw new Error(`The ${key} setting must be an object`);
  return value;
}

export interface McpSetupEdit {
  content: string;
  changes: McpSetupFilePreview['changes'];
  requiresReplacement: boolean;
}

function claudePermissionRules(
  permissions: Record<string, unknown>,
  decision: 'allow' | 'ask' | 'deny',
): string[] {
  const rules = own(permissions, decision);
  if (rules === undefined) return [];
  if (!Array.isArray(rules) || rules.some((rule) => typeof rule !== 'string'))
    throw new Error(`The permissions.${decision} setting must be an array of strings`);
  return rules;
}

function matchesClaudeRestriction(rule: string, tool: string): boolean {
  const pattern = rule.trim();
  if (pattern === claudeToolPrefix.slice(0, -2)) return true;
  // Claude Code settings support bare MCP rule names and tool-name star patterns.
  if (pattern.includes('(')) return false;
  if (!pattern.includes('*')) return pattern === tool;
  const [prefix, ...parts] = pattern.split('*');
  const suffix = parts.pop()!;
  if (!tool.startsWith(prefix) || !tool.endsWith(suffix)) return false;
  let offset = prefix.length;
  const end = tool.length - suffix.length;
  for (const part of parts) {
    const next = tool.indexOf(part, offset);
    if (next < 0 || next + part.length > end) return false;
    offset = next + part.length;
  }
  return offset <= end;
}

/**
 * Claude Code user settings: the local NCF marketplace, its enabled plugins (the
 * NCF plugin and the gate it depends on) and the exact NCF allow rules. Other
 * settings, comments and formatting are preserved; MCP servers are never added
 * outside the plugin.
 */
function editClaudeSettings(original: string, configuration: string): McpSetupEdit {
  const bom = original.startsWith('\uFEFF') ? '\uFEFF' : '';
  const source = original.slice(bom.length);
  let root: Record<string, unknown>;
  let desired: Record<string, unknown>;
  try {
    root = json(source);
    desired = json(configuration);
  } catch {
    throw new Error('The configuration contains invalid JSON');
  }
  // Claude Code rejects a settings file with comments or trailing commas and then
  // ignores all of it, so such a file is refused instead of being edited.
  const strict: ParseError[] = [];
  parse(source.trim() ? source : '{}', strict, {
    disallowComments: true,
    allowTrailingComma: false,
  });
  if (strict.length)
    throw new Error(
      'Claude Code settings must be plain JSON without comments or trailing commas. Fix the file in Claude Code first.',
    );
  const wanted = (key: string) => {
    const value = table(desired, key);
    const entries = Object.entries(value);
    if (entries.length !== 1) throw new Error('The generated Claude Code settings are invalid');
    return entries[0];
  };
  const [marketplace, entry] = wanted('extraKnownMarketplaces');
  const wantedPlugins = Object.entries(table(desired, 'enabledPlugins'));
  const rules = own(table(desired, 'permissions'), 'allow');
  if (
    !object(entry) ||
    !wantedPlugins.length ||
    wantedPlugins.some(([, enabled]) => enabled !== true) ||
    !Array.isArray(rules) ||
    rules.length !== claudeSetupAllowRules.length ||
    !claudeSetupAllowRules.every((rule) => rules.includes(rule))
  )
    throw new Error('The generated Claude Code settings are invalid');
  const markets = table(root, 'extraKnownMarketplaces');
  const plugins = table(root, 'enabledPlugins');
  const permissions = table(root, 'permissions');
  const allow = claudePermissionRules(permissions, 'allow');
  for (const decision of ['deny', 'ask'] as const) {
    const restrictions = claudePermissionRules(permissions, decision);
    const blocked = claudeSetupAllowRules.find((tool) =>
      restrictions.some((rule) => matchesClaudeRestriction(rule, tool)),
    );
    if (blocked) throw new Error(`Claude Code permissions.${decision} → ${blocked}`);
  }
  const previous = own(markets, marketplace);
  const marketEqual = containsSettings(previous, entry);
  const pluginStates = wantedPlugins.map(([plugin]) => [plugin, own(plugins, plugin)] as const);
  const missing = claudeSetupAllowRules.filter((rule) => !allow.includes(rule));
  const changes: McpSetupEdit['changes'] = [
    {
      scope: 'extraKnownMarketplaces.' + marketplace,
      action: marketEqual ? 'unchanged' : previous === undefined ? 'add' : 'replace',
    },
    ...pluginStates.map(([plugin, state]) => ({
      scope: 'enabledPlugins.' + plugin,
      action: (state === true ? 'unchanged' : state === undefined ? 'add' : 'replace') as
        'unchanged' | 'add' | 'replace',
    })),
    ...claudeSetupAllowRules.map((rule) => ({
      scope: `permissions.allow ${rule}`,
      action: (missing.includes(rule) ? 'add' : 'unchanged') as 'add' | 'unchanged',
    })),
  ];
  let content = source.trim() ? source : '{}';
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const options = {};
  if (!marketEqual)
    content = applyEdits(
      content,
      modify(content, ['extraKnownMarketplaces', marketplace], entry, options),
    );
  for (const [plugin, state] of pluginStates)
    if (state !== true)
      content = applyEdits(content, modify(content, ['enabledPlugins', plugin], true, options));
  for (const rule of missing)
    content = applyEdits(content, modify(content, ['permissions', 'allow', -1], rule, options));
  const parsed = json(content);
  if (!source.trim()) content = JSON.stringify(parsed, null, 2) + eol;
  if (!changes.some((change) => change.action !== 'unchanged')) content = source;
  return {
    content: bom + content,
    changes,
    requiresReplacement:
      (previous !== undefined && !marketEqual) ||
      pluginStates.some(([, state]) => state !== undefined && state !== true),
  };
}

export function codexMcpConfigurationMatches(source: string, configuration: string): boolean {
  const readServer = (content: string) =>
    own(table(parseToml(content.replace(/^\uFEFF/, '')), 'mcp_servers'), serverName);
  try {
    const installed = readServer(source);
    const intended = readServer(configuration);
    return (
      object(installed) &&
      installed.enabled !== false &&
      object(intended) &&
      containsSettings(installed, intended)
    );
  } catch {
    return false;
  }
}

export function editMcpConfiguration(
  client: McpSetupClient,
  original: string,
  configuration: string,
): McpSetupEdit {
  if (client === 'claude') return editClaudeSettings(original, configuration);
  const bom = original.startsWith('\uFEFF') ? '\uFEFF' : '';
  const source = original.slice(bom.length);
  const toml = client === 'codex';
  let root: Record<string, unknown>;
  let desired: Record<string, unknown>;
  try {
    root = toml ? parseToml(source) : json(source);
    desired = toml ? parseToml(configuration) : json(configuration);
  } catch {
    // Parser errors may contain user secrets from the source line.
    throw new Error(`The configuration contains invalid ${toml ? 'TOML' : 'JSON/JSONC'}`);
  }
  const parent = toml
    ? 'mcp_servers'
    : client === 'cursor' || client === 'aionui'
      ? 'mcpServers'
      : 'mcp';
  const servers = table(root, parent);
  if (
    client === 'opencode' &&
    (Object.hasOwn(servers, 'servers') || Object.hasOwn(root, 'plugins'))
  )
    throw new Error('OpenCode v2 configuration is not supported by this OpenCode v1 integration');
  const previous = own(servers, serverName);
  const next = table(desired, parent)[serverName];
  if (!object(next)) throw new Error('The generated MCP configuration is invalid');
  const equal = containsSettings(previous, next);
  const changes: McpSetupEdit['changes'] = [
    {
      scope: parent + '.' + serverName,
      action: equal ? 'unchanged' : previous === undefined ? 'add' : 'replace',
    },
  ];
  let content = source.trim() ? source : '{}';
  if (toml) {
    const updates: Record<string, unknown> = Object.create(null);
    if (!equal) updates[serverName] = next;
    const inbox = 'ncf_agent_interconnect_inbox';
    const inboxNext = own(table(desired, parent), inbox);
    // A separately named server must not expose reads omitted or restricted by the
    // owner's current setup. Existing independent entries retain their own policy.
    const oldInbox = own(servers, inbox);
    const customPolicy =
      object(previous) &&
      (previous.enabled === false ||
        Object.keys(previous).some(
          (key) =>
            ![
              'url',
              'http_headers',
              'enabled',
              'tool_timeout_sec',
              'startup_timeout_sec',
              'required',
            ].includes(key),
        ));
    if (inboxNext !== undefined && (oldInbox !== undefined || !customPolicy)) {
      if (!object(inboxNext)) throw new Error('The generated inbox configuration is invalid');
      const installed = oldInbox;
      const matches = containsSettings(installed, inboxNext);
      changes.push({
        scope: parent + '.' + inbox,
        action: matches ? 'unchanged' : installed === undefined ? 'add' : 'replace',
      });
      if (!matches) {
        const updatedInbox = Object.assign(Object.create(null), inboxNext);
        // Keep the owner's independent approval settings when a node URL or credential changes.
        if (object(installed)) {
          for (const key of [
            'enabled',
            'disabled_tools',
            'default_tools_approval_mode',
            'omit_tools_from',
            'tool_timeout_sec',
          ]) {
            if (Object.hasOwn(installed, key)) updatedInbox[key] = installed[key];
          }
          const policy = object(installed.tools) && installed.tools.agent_read;
          if (object(policy) && Object.hasOwn(policy, 'approval_mode'))
            updatedInbox.tools = Object.assign(Object.create(null), {
              agent_read: Object.assign(Object.create(null), updatedInbox.tools.agent_read, {
                approval_mode: policy.approval_mode,
              }),
            });
        }
        updates[inbox] = updatedInbox;
      }
    }
    if (Object.keys(updates).length) {
      const updated = Object.assign(Object.create(null), root, {
        [parent]: Object.assign(Object.create(null), servers, updates),
      });
      try {
        content = patchToml(source, updated);
        if (!isDeepStrictEqual(parseToml(content), updated)) throw new Error();
      } catch {
        throw new Error('The TOML configuration cannot be updated while preserving its structure');
      }
    } else content = source;
  } else {
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    // Formatting an affected line would also rewrite unrelated siblings on that line.
    const options = {};
    if (!equal) content = applyEdits(content, modify(content, [parent, serverName], next, options));
    if (client === 'opencode') {
      const plugins = own(root, 'plugin') ?? [];
      const required = desired.plugin;
      if (!Array.isArray(plugins) || plugins.some((value) => typeof value !== 'string'))
        throw new Error('The OpenCode plugin setting must be an array of strings');
      if (!Array.isArray(required) || required.length !== 1 || typeof required[0] !== 'string')
        throw new Error('The generated OpenCode plugin setting is invalid');
      const present = plugins.includes(required[0]);
      changes.push({ scope: 'plugin', action: present ? 'unchanged' : 'add' });
      if (!present)
        content = applyEdits(content, modify(content, ['plugin', -1], required[0], options));
    }
    const parsed = json(content);
    if (!source.trim()) content = JSON.stringify(parsed, null, 2) + eol;
  }
  return {
    content: bom + content,
    changes,
    requiresReplacement: changes.some((change) => change.action === 'replace'),
  };
}

/** Only the v2 managed server and its exact logical plugin entry are edited. */
export function editOpenCodeV2Configuration(original: string, configuration: string): McpSetupEdit {
  const bom = original.startsWith('\uFEFF') ? '\uFEFF' : '';
  const source = original.slice(bom.length);
  let root: Record<string, unknown>, desired: Record<string, unknown>;
  try {
    root = json(source);
    desired = json(configuration);
  } catch {
    throw new Error('The configuration contains invalid JSON/JSONC');
  }
  if (
    Object.hasOwn(root, 'plugin') ||
    Object.keys(table(root, 'mcp')).some((key) => !['servers', 'timeout'].includes(key))
  )
    throw new Error(
      'Select an OpenCode v2 configuration; a legacy v1 configuration cannot be converted',
    );
  const servers = table(table(root, 'mcp'), 'servers'),
    wanted = table(table(desired, 'mcp'), 'servers')[serverName];
  const plugins = own(root, 'plugins') ?? [],
    required = desired.plugins;
  if (
    !object(wanted) ||
    !Array.isArray(plugins) ||
    !Array.isArray(required) ||
    required.length !== 1 ||
    !object(required[0]) ||
    typeof required[0].package !== 'string' ||
    !object(required[0].options)
  )
    throw new Error('The OpenCode v2 integration configuration is invalid');
  const nextPlugin = required[0],
    targetId = (nextPlugin.options as Record<string, unknown>).targetId;
  if (typeof targetId !== 'string') throw new Error('The OpenCode v2 target is invalid');
  const indices = plugins.flatMap((plugin, index) =>
    object(plugin) && object(plugin.options) && plugin.options.targetId === targetId ? [index] : [],
  );
  if (indices.length > 1) throw new Error('The OpenCode v2 target has ambiguous plugin entries');
  const index = indices[0],
    previous = servers[serverName],
    equal = containsSettings(previous, wanted);
  const pluginEqual = index !== undefined && isDeepStrictEqual(plugins[index], nextPlugin);
  let content = source.trim() ? source : '{}';
  if (!equal)
    content = applyEdits(content, modify(content, ['mcp', 'servers', serverName], wanted, {}));
  if (!pluginEqual)
    content = applyEdits(content, modify(content, ['plugins', index ?? -1], nextPlugin, {}));
  json(content);
  if (!source.trim()) content = JSON.stringify(json(content), null, 2) + '\n';
  return {
    content: bom + content,
    changes: [
      {
        scope: 'mcp.servers.' + serverName,
        action: equal ? 'unchanged' : previous === undefined ? 'add' : 'replace',
      },
      {
        scope: 'plugins',
        action: pluginEqual ? 'unchanged' : index === undefined ? 'add' : 'replace',
      },
    ],
    requiresReplacement:
      (previous !== undefined && !equal) || (index !== undefined && !pluginEqual),
  };
}

/** Hash only the managed representation, leaving unrelated provider/user changes independent. */
export function openCodeV2ConfigurationHash(source: string): string {
  const root = json(source.replace(/^\uFEFF/, '')),
    server = table(table(root, 'mcp'), 'servers')[serverName];
  if (!object(server) || typeof server.url !== 'string')
    throw new Error('V2_TARGET_CONFIGURATION_MISMATCH');
  const url = new URL(server.url),
    match = /^\/integrations\/opencode-v2\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/mcp$/.exec(
      url.pathname,
    );
  if (!match || !Array.isArray(root.plugins)) throw new Error('V2_TARGET_CONFIGURATION_MISMATCH');
  const matches = root.plugins.filter(
    (plugin) => object(plugin) && object(plugin.options) && plugin.options.targetId === match[1],
  );
  if (
    matches.length !== 1 ||
    !object(matches[0]) ||
    !object(matches[0].options) ||
    matches[0].options.generation !== match[2]
  )
    throw new Error('V2_TARGET_CONFIGURATION_MISMATCH');
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : object(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(canonical({ server, plugin: matches[0] })))
    .digest('hex');
}
