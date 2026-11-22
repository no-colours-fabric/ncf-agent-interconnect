import { applyEdits, modify, parse, parseTree, type Node, type ParseError } from 'jsonc-parser';

export const cursorAgentSendPermission = 'ncf_agent_interconnect:agent_send';

export interface CursorPermissionsEdit {
  content: string;
  changed: boolean;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function assertUniqueKeys(node: Node): void {
  if (node.type === 'object') {
    const keys = new Set<string>();
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value as string;
      if (keys.has(key)) throw new Error('Cursor permissions contain duplicate object keys');
      keys.add(key);
    }
  }
  for (const child of node.children ?? []) assertUniqueKeys(child);
}

/**
 * Add the one exact Cursor MCP permission only when permissions.json already
 * owns the MCP allowlist. Creating that key would replace the active IDE list.
 */
export function editCursorPermissions(original: string): CursorPermissionsEdit {
  const bom = original.startsWith('\uFEFF') ? '\uFEFF' : '';
  const source = original.slice(bom.length);
  const errors: ParseError[] = [];
  const root: unknown = parse(source, errors, { allowTrailingComma: true });
  const tree = parseTree(source, [], { allowTrailingComma: true });
  if (errors.length || !tree || !object(root))
    throw new Error('Cursor permissions.json is not a valid JSON/JSONC object');
  assertUniqueKeys(tree);
  if (!Object.hasOwn(root, 'mcpAllowlist'))
    throw new Error(
      'Automatic replies were not enabled because Cursor currently owns the MCP allowlist in IDE settings',
    );
  const allowlist = root.mcpAllowlist;
  if (!Array.isArray(allowlist) || allowlist.some((entry) => typeof entry !== 'string'))
    throw new Error('Cursor permissions.json has an invalid mcpAllowlist');
  if (
    allowlist.some(
      (entry) => entry.toLocaleLowerCase('en-US') === cursorAgentSendPermission.toLowerCase(),
    )
  )
    return { content: original, changed: false };
  const content = applyEdits(
    source,
    modify(source, ['mcpAllowlist', -1], cursorAgentSendPermission, {}),
  );
  return { content: bom + content, changed: true };
}
