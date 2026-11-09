// Research prototype, not a product component. At session start it asks the
// isolated NCF fixture node, once, whether this exact native Claude Code
// session already has a pending NCF message on a proven route. If so it submits
// one fixed wake notice with default plugin attribution (never asUser). It
// never reads an inbox, never repeats a dropped or refused submission and never
// survives the end of the session scope it was started for.

const maxName = 120;

// One scope per load: the session id and whether it is still current.
let scope = null;

export function register(on) {
  on('session.start', ($, e, next) => {
    // Not awaited: the long request and the submission must not hold the start.
    firstWake($).catch(() => {});
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

async function report($, endpoint, body) {
  try {
    await $.http.fetch(endpoint.url + '/first-wake/result', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + endpoint.token },
      body: JSON.stringify(body),
    });
  } catch {
    // Evidence only; a failed report changes nothing.
  }
}

async function firstWake($) {
  const sessionId = await $.session.id();
  const own = { sessionId, current: true };
  scope = own;
  const file = await $.env.get('NCF_FIRST_WAKE_DESCRIPTOR');
  if (!file) return;
  const endpoint = JSON.parse(await $.fs.read(file));
  if (typeof endpoint.url !== 'string' || typeof endpoint.token !== 'string') return;
  const response = await $.http.fetch(endpoint.url + '/first-wake/pending', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + endpoint.token },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) return;
  const answer = JSON.parse(response.text);
  // A deadline or a fenced scope is a resource limit, never an incoming event.
  if (!own.current || scope !== own || answer.wake !== true || !validName(answer.nickname)) {
    await report($, endpoint, {
      sessionId,
      ticket: answer.ticket ?? null,
      outcome: own.current ? 'not-submitted:' + String(answer.reason ?? 'no-wake') : 'fenced',
    });
    return;
  }
  const result = await $.prompt.submit({ text: wakeText(answer.nickname) });
  await report($, endpoint, {
    sessionId,
    ticket: answer.ticket,
    outcome: result && typeof result.drop === 'string' ? 'dropped:' + result.drop : 'turn-started',
  });
}
