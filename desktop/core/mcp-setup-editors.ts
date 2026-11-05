import { isDeepStrictEqual } from 'node:util';
import { applyEdits, modify, parse, parseTree, type Node, type ParseError } from 'jsonc-parser';
import { parse as parseToml, patch as patchToml } from '@decimalturn/toml-patch';
import type { McpSetupClient, McpSetupFilePreview } from '../shared/mcp-setup.js';

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

/**
 * Claude Code user settings: the local NCF marketplace, its enabled plugin and
 * one exact allow rule. Other settings, comments and formatting are preserved;
 * MCP servers are never added outside the plugin.
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
  const [plugin, enabled] = wanted('enabledPlugins');
  const rules = own(table(desired, 'permissions'), 'allow');
  if (!object(entry) || enabled !== true || !Array.isArray(rules) || rules.length !== 1)
    throw new Error('The generated Claude Code settings are invalid');
  const rule = rules[0] as string;
  const markets = table(root, 'extraKnownMarketplaces');
  const plugins = table(root, 'enabledPlugins');
  const permissions = table(root, 'permissions');
  const allow = own(permissions, 'allow') ?? [];
  if (!Array.isArray(allow) || allow.some((value) => typeof value !== 'string'))
    throw new Error('The permissions.allow setting must be an array of strings');
  const previous = own(markets, marketplace);
  const marketEqual = containsSettings(previous, entry);
  const pluginState = own(plugins, plugin);
  const ruleExists = allow.includes(rule);
  const changes: McpSetupEdit['changes'] = [
    {
      scope: 'extraKnownMarketplaces.' + marketplace,
      action: marketEqual ? 'unchanged' : previous === undefined ? 'add' : 'replace',
    },
    {
      scope: 'enabledPlugins.' + plugin,
      action: pluginState === true ? 'unchanged' : pluginState === undefined ? 'add' : 'replace',
    },
    { scope: 'permissions.allow', action: ruleExists ? 'unchanged' : 'add' },
  ];
  let content = source.trim() ? source : '{}';
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const options = {};
  if (!marketEqual)
    content = applyEdits(
      content,
      modify(content, ['extraKnownMarketplaces', marketplace], entry, options),
    );
  if (pluginState !== true)
    content = applyEdits(content, modify(content, ['enabledPlugins', plugin], true, options));
  if (!ruleExists)
    content = applyEdits(content, modify(content, ['permissions', 'allow', -1], rule, options));
  const parsed = json(content);
  if (!source.trim()) content = JSON.stringify(parsed, null, 2) + eol;
  if (!changes.some((change) => change.action !== 'unchanged')) content = source;
  return {
    content: bom + content,
    changes,
    requiresReplacement:
      (previous !== undefined && !marketEqual) ||
      (pluginState !== undefined && pluginState !== true),
  };
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
    if (!equal) {
      const updated = Object.assign(Object.create(null), root, {
        [parent]: Object.assign(Object.create(null), servers, { [serverName]: next }),
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
    requiresReplacement: previous !== undefined && !equal,
  };
}
