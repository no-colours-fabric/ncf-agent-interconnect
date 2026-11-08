import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationStatus,
  connectionPresentation,
} from '../desktop/renderer/application-status.js';
import type { AdapterState, AgentIdentity } from '../desktop/shared/contracts.js';

function profile(
  id: string,
  state: AdapterState['state'],
  error: string | null = null,
  kind: AdapterState['kind'] = 'codex-desktop',
  lastOwnerVerifiedAt?: string,
): AdapterState {
  return {
    id,
    label: 'Desktop connection',
    kind,
    state,
    error,
    ...(lastOwnerVerifiedAt ? { lastOwnerVerifiedAt } : {}),
    capabilities: {
      wakeIdle: state === 'ready',
      receiveActive: state === 'ready',
      nativeDisplay: false,
      exactSession: state === 'ready',
    },
  };
}

const verified = '2026-11-01T10:00:00.000Z';

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
      ...['one', 'two', 'three', 'four'].map((id) =>
        profile(id, 'ready', null, 'codex-desktop', verified),
      ),
      profile('saved', 'error', 'Owner discovery failed'),
    ],
    agents = ['one', 'two', 'three', 'four'].map((id) => agent('Example ' + id, id)),
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.equal(status.summary, 'verifiedAll');
  assert.equal(status.agents.length, 4);
  assert.equal(status.connections.length, 5);
  assert.equal(status.issues.length, 1);
  assert.equal(status.issues[0].profile.id, 'saved');
  assert.equal(status.issues[0].profile.error, 'Owner discovery failed');
  assert.deepEqual(status.issues[0].agents, []);
});

test('mixed ready and failed bound connections report verified-only availability', () => {
  const adapters = [
      profile('ready', 'ready', null, 'codex-desktop', verified),
      profile('failed', 'error', 'Connection failed'),
    ],
    agents = [agent('Первый', 'ready'), agent('第二', 'failed')],
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.equal(status.summary, 'verifiedSome');
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
  assert.equal(status.summary, 'notConfirmed');
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
      profile('codex', 'ready', null, 'codex-desktop', verified),
      profile('opencode', 'error', 'Other application failed', 'opencode-http'),
    ],
    agents = [agent('Один', 'codex'), agent('Другой', 'opencode')],
    status = applicationStatus('codex-desktop', { adapters, agents });
  assert.equal(status.summary, 'verifiedAll');
  assert.equal(status.connections.length, 1);
  assert.equal(status.agents.length, 1);
  assert.equal(status.issues.length, 0);
});

test('available delivery and a saved unused connection require different user actions', () => {
  const readyVerified = profile('verified', 'ready', null, 'codex-desktop', verified);
  assert.equal(connectionPresentation(readyVerified, true).tone, 'default');
  assert.equal(connectionPresentation(readyVerified, true).status, 'clientsLastVerified');
  assert.equal(connectionPresentation(readyVerified, true).action, 'clientsCheckExactChat');
  const saved = connectionPresentation(readyVerified, false);
  assert.equal(saved.tone, 'default');
  assert.equal(saved.status, 'clientsLastVerified');
  assert.equal(saved.impact, 'clientsUnboundImpact');
  assert.equal(saved.action, 'clientsUseSavedAction');
});

test('a fresh OpenCode-ready bound connection keeps automatic delivery presentation', () => {
  const opencode = profile('opencode', 'ready', null, 'opencode-http');
  const bound = connectionPresentation(opencode, true);
  assert.equal(bound.tone, 'success');
  assert.equal(bound.status, 'clientsAuto');
  assert.equal(bound.action, 'clientsNoAction');
});

test('a Codex-ready bound connection without evidence stays not confirmed', () => {
  const connection = profile('codex', 'ready'),
    presentation = connectionPresentation(connection, true);
  assert.equal(presentation.tone, 'warning');
  assert.equal(presentation.status, 'clientsNotConfirmed');
  assert.equal(presentation.impact, 'clientsUnavailableImpact');
  assert.equal(presentation.action, 'clientsCheckExactChat');
  assert.equal(
    applicationStatus('codex-desktop', {
      adapters: [connection],
      agents: [agent('Проверка', 'codex')],
    }).summary,
    'notConfirmed',
  );
});

test('a Codex-ready unbound connection without evidence is neutral not confirmed', () => {
  const presentation = connectionPresentation(profile('codex', 'ready'), false);
  assert.equal(presentation.tone, 'default');
  assert.equal(presentation.status, 'clientsNotConfirmed');
  assert.equal(presentation.impact, 'clientsUnboundImpact');
  assert.equal(presentation.action, 'clientsUseSavedAction');
});

test('failed fetch, timeout and unknown diagnostics do not invent a root cause', () => {
  for (const error of [
    'fetch failed',
    'Codex IPC: request timed out',
    'Codex owner discovery failed for this exact chat',
    'No owner supporting external input was found for this Codex chat',
    'An unfamiliar connection diagnostic',
  ]) {
    const connection = profile('failed', 'error', error),
      before = structuredClone(connection),
      bound = connectionPresentation(connection, true),
      unused = connectionPresentation(connection, false);
    assert.equal(bound.tone, 'warning');
    assert.equal(bound.status, 'clientsNotConfirmed');
    assert.equal(bound.impact, 'clientsUnavailableImpact');
    assert.equal(bound.action, 'clientsCheckExactChat');
    assert.equal(unused.tone, 'default');
    assert.equal(unused.status, 'clientsNotConfirmed');
    assert.equal(unused.impact, 'clientsUnboundImpact');
    assert.equal(unused.action, 'clientsUseSavedAction');
    assert.deepEqual(connection, before);
  }
});

test('a released connection is a confirmed client release, not a transport failure', () => {
  const released = { ...profile('released', 'error', 'OpenCode is disconnected'), released: true },
    bound = connectionPresentation(released, true),
    unused = connectionPresentation(released, false);
  assert.equal(bound.tone, 'default');
  assert.equal(bound.status, 'clientsReleased');
  assert.equal(bound.impact, 'clientsReleasedImpact');
  assert.equal(bound.action, 'clientsReleasedAction');
  assert.equal(unused.tone, 'default');
  assert.equal(unused.status, 'clientsReleased');
  assert.equal(unused.impact, 'clientsUnboundImpact');
  assert.equal(unused.action, 'clientsUseSavedAction');
});

test('uncertain overrides a released connection and never allows an automatic retry', () => {
  const connection = {
      ...profile('uncertain', 'uncertain', 'The OpenCode event stream was closed', 'opencode-http'),
      released: true,
    },
    presentation = connectionPresentation(connection, true);
  assert.equal(presentation.status, 'clientsNeedsReview');
  assert.equal(presentation.impact, 'clientsUncertainImpact');
  assert.equal(presentation.action, 'clientsCheckBeforeRetry');
  assert.equal(presentation.tone, 'warning');
});

test('released connections are not counted as delivery issues', () => {
  const released = { ...profile('released', 'error', 'OpenCode is disconnected'), released: true },
    status = applicationStatus('codex-desktop', {
      adapters: [released],
      agents: [agent('Завершён', 'released')],
    });
  assert.equal(status.summary, 'released');
  assert.equal(status.issues.length, 0);
});

test('a bound not-confirmed connection is summarized as not confirmed, not paused', () => {
  const failed = profile('failed', 'error', 'fetch failed'),
    status = applicationStatus('codex-desktop', {
      adapters: [failed],
      agents: [agent('Симба', 'failed')],
    });
  assert.equal(status.summary, 'notConfirmed');
  assert.equal(status.issues.length, 1);
});

test('a released profile is not misreported as connected or as an issue', () => {
  const released = { ...profile('released', 'error', 'OpenCode is disconnected'), released: true },
    other = profile('other', 'ready', null, 'codex-desktop', verified),
    status = applicationStatus('codex-desktop', {
      adapters: [released, other],
      agents: [agent('Завершён', 'released'), agent('Активен', 'other')],
    });
  assert.equal(status.summary, 'verifiedSome');
  assert.equal(status.issues.length, 0);
});

test('a bound released+uncertain profile stays a single warning issue and blocks retry', () => {
  // Regression: the old "!profile.released && ..." predicate dropped an
  // uncertain profile that was also released. One profile must stay an issue.
  const releasedUncertain = {
      ...profile(
        'released-uncertain',
        'uncertain',
        'The OpenCode event stream was closed',
        'opencode-http',
      ),
      released: true,
    },
    status = applicationStatus('opencode-http', {
      adapters: [releasedUncertain],
      agents: [agent('Завершён-но-неподтверждён', 'released-uncertain')],
    });
  assert.equal(status.summary, 'paused');
  assert.equal(status.issues.length, 1);
  assert.equal(status.issues[0].profile.id, 'released-uncertain');
  const presentation = connectionPresentation(releasedUncertain, true);
  assert.equal(presentation.status, 'clientsNeedsReview');
  assert.equal(presentation.tone, 'warning');
  assert.equal(presentation.action, 'clientsCheckBeforeRetry');
});

test('an unbound released+uncertain profile still counts as a single warning issue', () => {
  const releasedUncertain = {
      ...profile(
        'released-uncertain',
        'uncertain',
        'The OpenCode event stream was closed',
        'opencode-http',
      ),
      released: true,
    },
    status = applicationStatus('opencode-http', { adapters: [releasedUncertain], agents: [] });
  assert.equal(status.summary, 'none');
  assert.equal(status.issues.length, 1);
  assert.equal(status.issues[0].profile.id, 'released-uncertain');
  const presentation = connectionPresentation(releasedUncertain, false);
  assert.equal(presentation.tone, 'warning');
  assert.equal(presentation.status, 'clientsNeedsReview');
  assert.equal(presentation.action, 'clientsCheckBeforeRetry');
});

test('uncertain admission always requires checking the exact chat before another send', () => {
  const connection = profile('uncertain', 'uncertain', 'Codex IPC: request timed out');
  for (const bound of [true, false]) {
    const presentation = connectionPresentation(connection, bound);
    assert.equal(presentation.tone, 'warning');
    assert.equal(presentation.status, 'clientsNeedsReview');
    assert.equal(presentation.impact, 'clientsUncertainImpact');
    assert.equal(presentation.action, 'clientsCheckBeforeRetry');
  }
});

test('normal manual MCP delivery is explanatory and not a connection error', () => {
  const presentation = connectionPresentation(profile('mcp', 'manual', null, 'manual'), true);
  assert.equal(presentation.tone, 'default');
  assert.equal(presentation.status, 'clientsReceiveMcp');
  assert.equal(presentation.impact, 'clientsManualImpact');
  assert.equal(presentation.action, 'clientsMcpAction');
});

test('checking is an unfinished availability check, without a success claim', () => {
  for (const bound of [true, false]) {
    const presentation = connectionPresentation(profile('checking', 'checking'), bound);
    assert.equal(presentation.tone, 'info');
    assert.equal(presentation.status, 'clientsChecking');
    assert.equal(presentation.impact, 'clientsCheckingImpact');
    assert.equal(presentation.action, 'clientsWaitAction');
  }
});

test('Cursor recovery is paused until the current response arms automatic delivery', () => {
  const connection = profile('cursor-recovery', 'recovering', null, 'cursor-hook');
  for (const bound of [true, false]) {
    const presentation = connectionPresentation(connection, bound);
    assert.equal(presentation.tone, 'info');
    assert.equal(presentation.status, 'clientsRecovering');
    assert.equal(presentation.impact, 'clientsRecoveringImpact');
    assert.equal(presentation.action, 'clientsRecoveringAction');
  }
  const status = applicationStatus('cursor-hook', {
    adapters: [connection],
    agents: [agent('Cursor agent', connection.id)],
  });
  assert.equal(status.summary, 'paused');
  assert.equal(status.issues.length, 0);
});

test('explicit rejection and absent support confirmation keep different explanations', () => {
  const rejected = connectionPresentation(
    profile('rejected', 'error', 'The handler for this Codex chat does not support external input'),
    true,
  );
  const unconfirmed = connectionPresentation(
    profile(
      'missing',
      'error',
      'The handler for this Codex chat did not confirm external input support',
    ),
    true,
  );
  assert.equal(rejected.impact, 'clientsUnsupportedImpact');
  assert.equal(rejected.action, 'clientsMcpAction');
  assert.equal(unconfirmed.impact, 'clientsUnconfirmedImpact');
  assert.equal(unconfirmed.action, 'clientsCheckExactChat');
});

test('inconsistent ready flags do not claim confirmed automatic delivery', () => {
  const cases = [
    { ...profile('diagnostic', 'ready'), error: 'An unresolved diagnostic' },
    {
      ...profile('no-wake', 'ready'),
      capabilities: { ...profile('no-wake', 'ready').capabilities, wakeIdle: false },
    },
    {
      ...profile('no-target', 'ready'),
      capabilities: { ...profile('no-target', 'ready').capabilities, exactSession: false },
    },
  ];
  for (const connection of cases) {
    const presentation = connectionPresentation(connection, true);
    assert.equal(presentation.impact, 'clientsUnavailableImpact');
    assert.equal(presentation.action, 'clientsCheckExactChat');
    assert.notEqual(presentation.tone, 'success');
    assert.equal(
      applicationStatus('codex-desktop', {
        adapters: [connection],
        agents: [agent('Проверка', connection.id)],
      }).summary,
      'notConfirmed',
    );
  }
});

test('a verified Codex-ready profile with a current failure is not masked as Last verified', () => {
  // Regression: the Codex-ready branch must not let a historical stamp override
  // a known failure. Error and missing capabilities stay above the stamp.
  for (const profileOf of [
    () => ({
      ...profile('bad-error', 'ready', 'An unresolved diagnostic', 'codex-desktop', verified),
    }),
    () => ({
      ...profile('bad-wake', 'ready', null, 'codex-desktop', verified),
      capabilities: {
        ...profile('bad-wake', 'ready', null, 'codex-desktop', verified).capabilities,
        wakeIdle: false,
      },
    }),
    () => ({
      ...profile('bad-exact', 'ready', null, 'codex-desktop', verified),
      capabilities: {
        ...profile('bad-exact', 'ready', null, 'codex-desktop', verified).capabilities,
        exactSession: false,
      },
    }),
  ]) {
    const connection = profileOf();
    for (const bound of [true, false]) {
      const presentation = connectionPresentation(connection, bound);
      assert.notEqual(presentation.status, 'clientsLastVerified', 'stamp must not win');
      assert.equal(
        presentation.impact,
        bound ? 'clientsUnavailableImpact' : 'clientsUnboundImpact',
      );
      assert.equal(presentation.action, bound ? 'clientsCheckExactChat' : 'clientsUseSavedAction');
      assert.equal(presentation.tone, bound ? 'warning' : 'default');
    }
    assert.equal(
      applicationStatus('codex-desktop', {
        adapters: [connection],
        agents: [agent('Проверка', connection.id)],
      }).summary,
      'notConfirmed',
    );
  }
});

test('explicit Codex unsupported and unconfirmed support stay distinct even with a verification stamp', () => {
  const rejected = {
      ...profile(
        'rejected-verified',
        'ready',
        'The handler for this Codex chat does not support external input',
        'codex-desktop',
        verified,
      ),
    },
    unconfirmed = {
      ...profile(
        'unconfirmed-verified',
        'ready',
        'The handler for this Codex chat did not confirm external input support',
        'codex-desktop',
        verified,
      ),
    };
  for (const bound of [true, false]) {
    const rejectedPresentation = connectionPresentation(rejected, bound);
    assert.equal(rejectedPresentation.status, bound ? 'clientsPaused' : 'clientsNotConfirmed');
    assert.equal(
      rejectedPresentation.impact,
      bound ? 'clientsUnsupportedImpact' : 'clientsUnboundImpact',
    );
    assert.equal(rejectedPresentation.action, bound ? 'clientsMcpAction' : 'clientsUseSavedAction');
    assert.equal(rejectedPresentation.tone, bound ? 'warning' : 'default');
    const unconfirmedPresentation = connectionPresentation(unconfirmed, bound);
    assert.equal(unconfirmedPresentation.status, bound ? 'clientsPaused' : 'clientsNotConfirmed');
    assert.equal(
      unconfirmedPresentation.impact,
      bound ? 'clientsUnconfirmedImpact' : 'clientsUnboundImpact',
    );
    assert.equal(
      unconfirmedPresentation.action,
      bound ? 'clientsCheckExactChat' : 'clientsUseSavedAction',
    );
    assert.equal(unconfirmedPresentation.tone, bound ? 'warning' : 'default');
  }
  const rejectedStatus = applicationStatus('codex-desktop', {
    adapters: [rejected],
    agents: [agent('Отклонён', 'rejected-verified')],
  });
  assert.equal(rejectedStatus.summary, 'notConfirmed');
  assert.equal(rejectedStatus.issues.length, 1);
});
