import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationStatus } from '../desktop/renderer/application-status.js';
import type { AdapterState, AgentIdentity } from '../desktop/shared/contracts.js';

function profile(
  id: string,
  state: AdapterState['state'],
  error: string | null = null,
  kind: AdapterState['kind'] = 'codex-desktop',
): AdapterState {
  return {
    id,
    label: 'Desktop connection',
    kind,
    state,
    error,
    capabilities: {
      wakeIdle: state === 'ready',
      receiveActive: state === 'ready',
      nativeDisplay: false,
      exactSession: state === 'ready',
    },
  };
}

function agent(nickname: string, adapterId: string | null): AgentIdentity {
  return {
    key: nickname.toLowerCase(),
    nickname,
    binding: adapterId
      ? {
          adapterId,
          client: 'Example client',
          chatId: 'exact-chat',
          connectionId: 'test',
          generation: 1,
        }
      : null,
    messageCount: 3,
    unread: 1,
  };
}

test('working bound agents and an unavailable saved connection are reported separately', () => {
  const adapters = [
      ...['one', 'two', 'three', 'four'].map((id) => profile(id, 'ready')),
      profile('saved', 'error', 'Owner discovery failed'),
    ],
    agents = ['one', 'two', 'three', 'four'].map((id) => agent('Example ' + id, id)),
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.equal(status.summary, 'connected');
  assert.equal(status.agents.length, 4);
  assert.equal(status.connections.length, 5);
  assert.equal(status.issues.length, 1);
  assert.equal(status.issues[0].profile.id, 'saved');
  assert.equal(status.issues[0].profile.error, 'Owner discovery failed');
  assert.deepEqual(status.issues[0].agents, []);
});

test('mixed ready and failed bound connections report partial availability', () => {
  const adapters = [profile('ready', 'ready'), profile('failed', 'error', 'Connection failed')],
    agents = [agent('Первый', 'ready'), agent('第二', 'failed')],
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.equal(status.summary, 'partial');
  assert.equal(status.issues.length, 1);
  assert.deepEqual(
    status.issues[0].agents.map((value) => value.nickname),
    ['第二'],
  );
});

test('an available unbound profile cannot mark an unavailable bound agent as connected', () => {
  const adapters = [profile('unbound', 'ready'), profile('bound', 'error', 'Connection failed')],
    agents = [agent('История', null), agent('Ожидающий', 'bound')],
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.equal(status.summary, 'paused');
  assert.deepEqual(
    status.agents.map((value) => value.nickname),
    ['Ожидающий'],
  );
  assert.deepEqual(status.connections[0].agents, []);
});

test('saved profiles without bindings remain visible without claiming connected agents', () => {
  const adapters = [profile('available', 'ready'), profile('unavailable', 'error', 'No handler')],
    status = applicationStatus('codex-desktop', { adapters, agents: [] });
  assert.equal(status.summary, 'none');
  assert.deepEqual(
    status.connections.map(({ profile }) => profile.id),
    ['available', 'unavailable'],
  );
  assert.equal(status.issues.length, 1);
});

test('manual bindings retain MCP delivery semantics without automatic readiness', () => {
  const adapters = [profile('manual', 'manual', null, 'manual')],
    status = applicationStatus('manual', { adapters, agents: [agent('MCP', 'manual')] });
  assert.equal(status.summary, 'manual');
  assert.equal(status.issues.length, 0);
  assert.equal(applicationStatus('manual', { adapters, agents: [] }).summary, 'none');
});

test('checking profiles are retained without claiming readiness or inventing an error', () => {
  const adapters = [profile('bound', 'checking'), profile('saved', 'checking')],
    status = applicationStatus('codex-desktop', { adapters, agents: [agent('Проверка', 'bound')] });
  assert.equal(status.summary, 'paused');
  assert.deepEqual(
    status.connections.map(({ profile }) => profile.state),
    ['checking', 'checking'],
  );
  assert.equal(status.issues.length, 0);
});

test('uncertain and error states count as issues even without an error string', () => {
  const adapters = [profile('uncertain', 'uncertain'), profile('error', 'error')],
    status = applicationStatus('codex-desktop', {
      adapters,
      agents: [agent('Проверка', 'uncertain')],
    });
  assert.equal(status.summary, 'paused');
  assert.equal(status.issues.length, 2);
});

test('connection errors stay associated with exact adapter IDs and Unicode names', () => {
  const adapters = [profile('a', 'error', 'First issue'), profile('b', 'error', 'Second issue')],
    agents = [agent('Агент 漢字', 'b'), agent('İsim', 'a'), agent('Без привязки', null)],
    before = structuredClone({ adapters, agents }),
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.deepEqual(
    status.issues.map(({ profile, agents }) => ({
      id: profile.id,
      error: profile.error,
      names: agents.map((value) => value.nickname),
    })),
    [
      { id: 'a', error: 'First issue', names: ['İsim'] },
      { id: 'b', error: 'Second issue', names: ['Агент 漢字'] },
    ],
  );
  assert.deepEqual({ adapters, agents }, before);
});

test('application summaries do not include another integration kind', () => {
  const adapters = [
      profile('codex', 'ready'),
      profile('opencode', 'error', 'Other application failed', 'opencode-http'),
    ],
    agents = [agent('Один', 'codex'), agent('Другой', 'opencode')],
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.equal(status.summary, 'connected');
  assert.equal(status.connections.length, 1);
  assert.equal(status.agents.length, 1);
  assert.equal(status.issues.length, 0);
});
