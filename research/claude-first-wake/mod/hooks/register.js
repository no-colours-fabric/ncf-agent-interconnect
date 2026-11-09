// Research prototype, not a product component. At session start it asks the
// isolated NCF fixture node, once, whether this exact native Claude Code
// session already has a pending NCF message on a proven route. If so it consumes
// the node's one-use claim and submits one fixed wake notice with default plugin
// attribution (never asUser). It never reads an inbox, never repeats a dropped
// or refused submission and never acts for a lifecycle other than the one it
// was started in. A mod's own hooks do not see its own submission, so the check
// right before the queued notice starts a turn lives in the separate
// ncf-first-wake-gate plugin, loaded after this one.

const maxName = 120;

// The current lifecycle fence. session.start replaces it synchronously and
// session.end clears it; an older continuation can only see itself fenced.
let scope = null;

function current(own) {
  return own.current && scope === own;
}

export function register(on) {
  on('session.start', ($, e, next) => {
    if (scope) scope.current = false;
    const own = { current: true, sessionId: null };
    scope = own;
    // Not awaited: the long request and the submission must not hold the start.
    firstWake($, own).catch(() => {});
    return next(e);
  });
  on('session.end', ($, e, next) => {
    // /clear, /resume, /branch and exit fence the scope; nothing is resubmitted.
    if (scope) scope.current = false;
    scope = null;
    return next(e);
  });
}

export function wakeText(nickname) {
  return (
    'NCF Agent Interconnect messages were already waiting for agent ' +
    JSON.stringify(nickname) +
    ' when this session started. Call agent_read for this agent now and continue with nextCursor while hasMore is true. This notice contains no message content.'
  );
}

function validName(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxName &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

async function post($, endpoint, route, body) {
  const response = await $.http.fetch(endpoint.url + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + endpoint.token },
    body: JSON.stringify(body),
  });
  return response.ok ? JSON.parse(response.text) : { error: 'http-' + response.status };
}

async function report($, endpoint, body) {
  try {
    await post($, endpoint, '/first-wake/result', body);
  } catch {
    // Evidence only; a failed report changes nothing.
  }
}

async function firstWake($, own) {
  const sessionId = await $.session.id();
  if (!current(own)) return;
  own.sessionId = sessionId;
  const file = await $.env.get('NCF_FIRST_WAKE_DESCRIPTOR');
  if (!file || !current(own)) return;
  const endpoint = JSON.parse(await $.fs.read(file));
  if (typeof endpoint.url !== 'string' || typeof endpoint.token !== 'string' || !current(own))
    return;
  let answer;
  try {
    answer = await post($, endpoint, '/first-wake/pending', { sessionId });
  } catch {
    // For example the 30 second $.http.fetch limit: never a wake, never retried.
    await report($, endpoint, { sessionId, claim: null, outcome: 'query-failed' });
    return;
  }
  const claim = typeof answer.claim === 'string' ? answer.claim : null;
  // A deadline or a fenced scope is a resource limit, never an incoming event.
  if (!current(own) || answer.wake !== true || !claim || !validName(answer.nickname)) {
    await report($, endpoint, {
      sessionId,
      claim,
      outcome: current(own) ? 'not-submitted:' + String(answer.reason ?? 'no-wake') : 'fenced',
    });
    return;
  }
  const consumed = await post($, endpoint, '/first-wake/claim', { sessionId, claim });
  if (!current(own) || consumed.consumed !== true) {
    await report($, endpoint, {
      sessionId,
      claim,
      outcome: current(own) ? 'claim:' + String(consumed.reason ?? 'refused') : 'fenced',
    });
    return;
  }
  const result = await $.prompt.submit({ text: wakeText(answer.nickname) });
  await report($, endpoint, {
    sessionId,
    claim,
    outcome: result && typeof result.drop === 'string' ? 'dropped:' + result.drop : 'turn-started',
  });
}
