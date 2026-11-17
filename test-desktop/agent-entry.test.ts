import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredAgentApplications } from '../desktop/renderer/agent-entry-model.js';
import {
  agentEntryMessages,
  formatAgentApplications,
  formatAgentEntryMessage,
  supportedAgentApplications,
} from '../desktop/renderer/i18n/agent-entry.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import type {
  AdapterState,
  AgentDirectory,
  AgentIdentity,
  Snapshot,
} from '../desktop/shared/contracts.js';

const adapter = (id: string, kind: AdapterState['kind']): AdapterState => ({
  id,
  label: id,
  kind,
  state: 'ready',
  error: null,
  capabilities: { wakeIdle: true, receiveActive: true, nativeDisplay: true, exactSession: true },
});

const agent = (
  nickname: string,
  adapterId: string | null,
  client = 'Private client',
): AgentIdentity => ({
  nickname,
  key: nickname.toLocaleLowerCase(),
  incarnation: nickname + '-incarnation',
  binding: adapterId
    ? { connectionId: nickname, client, chatId: nickname + '-chat', adapterId, generation: 1 }
    : null,
  messageCount: 0,
  unread: 0,
});

const directory = (
  entries: AgentDirectory['agents'],
  state: AgentDirectory['state'] = 'ready',
): AgentDirectory => ({
  nodeId: '00000000-0000-4000-8000-000000000001',
  nodeLabel: 'Local',
  local: true,
  state,
  epoch: '00000000-0000-4000-8000-000000000002',
  revision: 1,
  updatedAt: null,
  total: entries.length,
  truncated: false,
  agents: entries,
});

const snapshot = (
  agents: AgentIdentity[],
  adapters: AdapterState[],
  localDirectory: AgentDirectory,
  running = true,
): Pick<Snapshot, 'agents' | 'adapters' | 'directories' | 'running'> => ({
  agents,
  adapters,
  directories: [localDirectory],
  running,
});

test('configured application evidence comes from local bindings without fabricating readiness', () => {
  const result = configuredAgentApplications(
    snapshot(
      [
        agent('Cursor ready', 'cursor', 'Ignored client label'),
        agent('Aion unknown', 'aion', 'Ignored client label'),
        agent('OpenCode generic', 'manual', 'OpenCode'),
        agent('Diagnostic only', null),
      ],
      [adapter('cursor', 'cursor-hook'), adapter('aion', 'aionui'), adapter('manual', 'manual')],
      directory([
        { nickname: 'Cursor ready', availability: 'online', delivery: 'automatic' },
        { nickname: 'Aion unknown', availability: 'unknown', delivery: 'unknown' },
        { nickname: 'OpenCode generic', availability: 'unknown', delivery: 'mcp' },
      ]),
    ),
  );
  assert.deepEqual(result, [
    { application: 'cursor', availability: 'online' },
    { application: 'opencode', availability: 'unknown' },
    { application: 'aionui', availability: 'unknown' },
  ]);
});

test('installed adapters and manual agents without bindings do not claim configured applications', () => {
  assert.deepEqual(
    configuredAgentApplications(
      snapshot(
        [agent('Manual diagnostic', null)],
        [adapter('cursor', 'cursor-hook'), adapter('claude', 'claude-code')],
        directory([]),
      ),
    ),
    [],
  );
});

test('generic MCP bindings preserve the actual client label instead of guessing a product', () => {
  assert.deepEqual(
    configuredAgentApplications(
      snapshot(
        [agent('Custom client', 'manual', 'Private Cursor Lab')],
        [adapter('manual', 'manual')],
        directory([{ nickname: 'Custom client', availability: 'unknown', delivery: 'mcp' }]),
      ),
    ),
    [{ application: 'client:Private Cursor Lab', availability: 'unknown' }],
  );
});

test('all agent entry translations are complete and keep their required placeholders', () => {
  const english = agentEntryMessages('en');
  const keys = Object.keys(english).sort();
  for (const locale of supportedLocales) {
    const messages = agentEntryMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), keys, locale);
    for (const [key, value] of Object.entries(messages))
      assert.ok(value.trim(), `${locale}: ${key}`);
    assert.match(messages.agentsCreationConnected, /\{applications\}/, locale);
    assert.match(messages.agentsCreationNoConnected, /\{applicationsPage\}/, locale);
    assert.match(messages.agentsCreationNoConnected, /\{applications\}/, locale);
    assert.equal(messages.agentsManualDiagnosticLink, messages.dialogAddAgent, locale);
    if (locale !== 'en')
      for (const key of [
        'agentsConnectionGuide',
        'agentsCopyCommand',
        'agentsCreationConnected',
        'agentsCreationNoConnected',
        'agentsManualDiagnosticIntro',
        'agentsManualDiagnosticLink',
        'dialogAddAgentBody',
        'dialogManualAgentDiagnostic',
        'agentEmptyPrompt',
        'aionUiApplication',
      ] as const)
        assert.notEqual(messages[key], english[key], `${locale}: English fallback in ${key}`);
  }
});

test('connection panel copy is localized in all 15 locales and reuses the chosen-name request', () => {
  const english = agentEntryMessages('en');
  assert.equal(
    english.agentsConnectionGuide,
    'Open a new or existing chat in a supported app and ask the assistant to connect under a name you choose.',
  );
  assert.equal(english.agentsCopyCommand, 'Copy');
  for (const locale of supportedLocales) {
    const copy = agentEntryMessages(locale);
    const request = mcpSetupMessages(locale);
    for (const key of ['agentsConnectionGuide', 'agentsCopyCommand'] as const) {
      assert.ok(copy[key].trim(), `${locale}: ${key}`);
      if (locale !== 'en') assert.notEqual(copy[key], english[key], `${locale}: ${key}`);
    }
    assert.ok(request.connectionPrompt.trim(), `${locale}: visible request`);
    assert.ok(request.copyPrompt.trim(), `${locale}: accessible copy action`);
    assert.ok(!copy.agentsConnectionGuide.includes('{applications}'));
    assert.ok(!copy.agentsConnectionGuide.includes('{applicationsPage}'));
  }
});

test('application lists use localized conjunctions and preserve the complete supported set', () => {
  assert.equal(formatAgentApplications('en', ['cursor', 'opencode']), 'Cursor and OpenCode');
  assert.equal(formatAgentApplications('ru', ['cursor', 'opencode']), 'Cursor и OpenCode');
  const supported = supportedAgentApplications('fr');
  for (const product of [
    'Codex Desktop',
    'Claude Code',
    'Cursor',
    'OpenCode',
    'AionUi avec Cursor Agent',
  ])
    assert.ok(supported.includes(product), product);
  assert.equal(
    formatAgentEntryMessage('en', 'agentsCreationConnected', { applications: 'Cursor' }),
    'Start with several chats in one app. Ask each assistant to connect under a name you choose and give it a role in the shared task. Configured apps: Cursor.',
  );
});
