// Research prototype, not a product component. At session start it asks the
// isolated NCF fixture node, once, whether this exact native Claude Code
// session already has a pending NCF message on a proven route. If so it consumes
// the node's one-use claim and submits one fixed wake notice with default plugin
// attribution (never asUser). Right before that prompt starts a turn, its own
// prompt.submit hook revalidates the lifecycle and the claim and drops a stale
// notice. It never reads an inbox, never repeats a dropped or refused
// submission and never acts for a lifecycle other than the one it was started in.

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
    const own = { current: true, sessionId: null, claim: null, text: null };
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
  on('prompt.submit', async ($, e, next) => {
    // The event carries no prompt origin, and next.origin names whoever fired the
    // event (the engine when a queued prompt is dequeued), so the notice is
    // recognised by its exact text.
    if (!isWakeText(e.text)) return next(e);
    const own = scope;
    if (own?.endpoint)
      await report($, own.endpoint, {
        sessionId: own.sessionId,
        claim: own.claim,
        outcome: 'prompt-hook:' + String(next.origin?.plugin ?? 'none'),
      });
    // A notice from a fenced lifecycle is never let through.
    if (!own || own.text !== e.text)
      return { drop: 'NCF wake notice from an ended session lifecycle. Messages stay unread.' };
    own.text = null;
    const verdict = await startCheck($, own).catch(() => 'start-check-failed');
    if (verdict !== 'started') {
      own.current = false;
      return { drop: 'NCF wake notice withdrawn: ' + verdict + '. Messages stay unread.' };
    }
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

function isWakeText(text) {
  return (
    typeof text === 'string' &&
    text.startsWith('NCF Agent Interconnect messages were already waiting for agent ')
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

// The last check before the queued notice starts a turn.
async function startCheck($, own) {
  if (!current(own)) return 'fenced';
  if ((await $.session.id()) !== own.sessionId || !current(own)) return 'fenced:session';
  const answer = await post($, own.endpoint, '/first-wake/start', {
    sessionId: own.sessionId,
    claim: own.claim,
  });
  if (!current(own)) return 'fenced';
  const verdict =
    answer.started === true ? 'started' : 'claim:' + String(answer.reason ?? 'refused');
  await report($, own.endpoint, {
    sessionId: own.sessionId,
    claim: own.claim,
    outcome: 'start-check:' + verdict,
  });
  return verdict;
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
  own.endpoint = endpoint;
  const answer = await post($, endpoint, '/first-wake/pending', { sessionId });
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
  const text = wakeText(answer.nickname);
  own.claim = claim;
  own.text = text;
  const result = await $.prompt.submit({ text });
  if (own.text === text) own.text = null;
  await report($, endpoint, {
    sessionId,
    claim,
    outcome: result && typeof result.drop === 'string' ? 'dropped:' + result.drop : 'turn-started',
  });
}
