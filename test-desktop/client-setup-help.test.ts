import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasUsableClientSetup } from '../desktop/renderer/ClientSetupHelp.js';
import { ClaudeSetupDialog } from '../desktop/renderer/McpSetup.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import type { McpSetupStatus } from '../desktop/shared/mcp-setup.js';
import type { AdapterState, AgentIdentity } from '../desktop/shared/contracts.js';

const configured: McpSetupStatus = {
  client: 'claude',
  state: 'configured',
  remembered: true,
  files: [],
};
const noInvoke = async (): Promise<never> => {
  throw new Error('Rendering help must not invoke setup');
};

test('setup help is hidden for pending, failed, outdated and foreign settings', () => {
  assert.equal(hasUsableClientSetup('claude', undefined, undefined, undefined), false);
  assert.equal(hasUsableClientSetup('claude', configured, 'check failed', undefined), false);
  assert.equal(hasUsableClientSetup('cursor', configured, undefined, undefined), false);
  for (const state of ['missing', 'not-configured', 'needs-update', 'unavailable'] as const) {
    const status = { ...configured, state };
    const html = renderToStaticMarkup(
      createElement(ClaudeSetupDialog, {
        invoke: noInvoke,
        messages: mcpSetupMessages('en'),
        check: { status },
      }),
    );
    assert.ok(!html.includes('data-testid="client-setup-help"'), state);
  }
});

test('configured help follows the adapter heading and precedes status, in the selected language', () => {
  for (const locale of ['en', 'ru'] as const) {
    const html = renderToStaticMarkup(
      createElement(ClaudeSetupDialog, {
        invoke: noInvoke,
        messages: mcpSetupMessages(locale),
        check: { status: configured },
        locale,
      }),
    );
    const heading = html.indexOf('<h2');
    const help = html.indexOf('data-testid="client-setup-help"');
    const status = html.indexOf('data-testid="client-status-panel"');
    assert.ok(heading >= 0 && heading < help && help < status);
    assert.equal((html.match(/data-testid="client-setup-help"/g) ?? []).length, 1);
    assert.ok(
      html.includes(locale === 'ru' ? 'Можно ли сохранить разрешения?' : 'Can I save permissions?'),
    );
    assert.ok(html.includes('/permissions'));
    assert.ok(html.includes('agent_read, agent_connect'));
    assert.ok(!html.includes('mcp__*'));
  }
});

const live = (): AdapterState => ({
  id: 'current',
  label: 'Claude Code',
  kind: 'claude-code',
  state: 'ready',
  error: null,
  capabilities: { wakeIdle: true, receiveActive: true, nativeDisplay: true, exactSession: true },
});
const bound: AgentIdentity = {
  key: 'owner',
  nickname: 'Owner',
  binding: {
    adapterId: 'current',
    client: 'Claude Code',
    connectionId: 'connection',
    chatId: 'exact',
    generation: 1,
  },
  messageCount: 0,
  unread: 0,
};

test('only a currently working bound adapter can substitute for a successful settings check', () => {
  const snapshot = { adapters: [live()], agents: [bound] };
  assert.equal(hasUsableClientSetup('claude', undefined, undefined, snapshot), true);
  assert.equal(hasUsableClientSetup('cursor', undefined, undefined, snapshot), false);
  assert.equal(
    hasUsableClientSetup('claude', undefined, undefined, { ...snapshot, agents: [] }),
    false,
  );
  for (const state of ['checking', 'recovering', 'error', 'uncertain'] as const)
    assert.equal(
      hasUsableClientSetup('claude', undefined, undefined, {
        ...snapshot,
        adapters: [{ ...live(), state }],
      }),
      false,
    );
  for (const patch of [{ released: true }, { error: 'disconnected' }])
    assert.equal(
      hasUsableClientSetup('claude', undefined, undefined, {
        ...snapshot,
        adapters: [{ ...live(), ...patch }],
      }),
      false,
    );
});

test('AionUi settings alone do not imply completed authorization', () => {
  const status = { ...configured, client: 'aionui' as const };
  assert.equal(hasUsableClientSetup('aionui', status, undefined, undefined, false), false);
  assert.equal(hasUsableClientSetup('aionui', status, undefined, undefined, true), true);
});
