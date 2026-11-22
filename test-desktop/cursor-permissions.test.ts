import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as parseJson } from 'jsonc-parser';
import {
  cursorAgentSendPermission,
  editCursorPermissions,
} from '../desktop/core/cursor-permissions.js';

test('Cursor file-owned MCP allowlist keeps JSONC, Unicode and unrelated rules', () => {
  const source =
    '\uFEFF{\r\n  // владелец\r\n  "mcpAllowlist": ["github:list_issues"],\r\n  "terminalAllowlist": ["git status"],\r\n}\r\n';
  const edit = editCursorPermissions(source);
  const parsed = parseJson(edit.content.slice(1));
  assert.equal(edit.changed, true);
  assert.deepEqual(parsed.mcpAllowlist, ['github:list_issues', cursorAgentSendPermission]);
  assert.deepEqual(parsed.terminalAllowlist, ['git status']);
  assert.ok(edit.content.startsWith('\uFEFF'));
  assert.ok(edit.content.includes('// владелец\r\n'));
  assert.equal(editCursorPermissions(edit.content).content, edit.content);
});

test('Cursor MCP permission matching is case-insensitive and never broadens the rule', () => {
  const source = '{"mcpAllowlist":["NCF_AGENT_INTERCONNECT:AGENT_SEND","other:*"]}\n';
  const edit = editCursorPermissions(source);
  assert.equal(edit.changed, false);
  assert.equal(edit.content, source);
  assert.equal(edit.content.includes('ncf_agent_interconnect:*'), false);
});

test('Cursor IDE-owned, malformed and duplicate permission states fail closed', () => {
  assert.throws(() => editCursorPermissions('{"terminalAllowlist":["git"]}\n'), /IDE settings/);
  assert.throws(() => editCursorPermissions('{"mcpAllowlist":"other:tool"}\n'), /invalid/);
  assert.throws(
    () => editCursorPermissions('{"mcpAllowlist":[],"mcpAllowlist":[]}\n'),
    /duplicate/,
  );
  assert.throws(() => editCursorPermissions('{broken'), /valid JSON\/JSONC/);
});
