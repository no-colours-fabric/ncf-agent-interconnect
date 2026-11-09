// Research prototype, not a product component. The start check for the
// ncf-first-wake-research notice. A mod's own hooks never see its own
// $.prompt.submit, and a prompt submitted by one mod reaches the prompt.submit
// hooks of the mods that run after it, with next.origin naming the submitter
// (observed natively with Claude Code 2.1.318). Loaded after that mod, this gate
// checks the notice right before it starts a turn: the session lifecycle it was
// loaded in has not ended, and the node confirms the consumed claim for this
// exact session once. Anything else, or a failed check, drops the notice. Other
// prompts pass unchanged.

const source = 'ncf-first-wake-research';
const prefix = 'NCF Agent Interconnect messages were already waiting for agent ';

// The current lifecycle. session.start replaces it and session.end ends it.
let lifecycle = null;

/** Whether this prompt is the first-wake notice that this gate must check. */
export function gated(origin, text) {
  return origin?.plugin === source && typeof text === 'string' && text.startsWith(prefix);
}

export function register(on) {
  on('session.start', ($, e, next) => {
    if (lifecycle) lifecycle.ended = true;
    const own = { ended: false, endpoint: null };
    own.loading = load($, own).catch(() => {});
    lifecycle = own;
    return next(e);
  });
  on('session.end', ($, e, next) => {
    if (lifecycle) lifecycle.ended = true;
    lifecycle = null;
    return next(e);
  });
  on('prompt.submit', async ($, e, next) => {
    if (!gated(next.origin, e.text)) return next(e);
    const refusal = await check($, lifecycle);
    return refusal ? { drop: refusal } : next(e);
  }).catch(($, e, next) => {
    // A failed or timed-out check never lets the notice through.
    if (next.called || !gated(next.origin, e.text)) return next(e);
    return {
      drop: 'NCF wake notice withdrawn: check ' + next.error.kind + '. Messages stay unread.',
    };
  });
}

async function load($, own) {
  const file = await $.env.get('NCF_FIRST_WAKE_DESCRIPTOR');
  if (!file) return;
  const value = JSON.parse(await $.fs.read(file));
  if (typeof value.url === 'string' && typeof value.token === 'string') own.endpoint = value;
}

async function post($, endpoint, route, body) {
  const response = await $.http.fetch(endpoint.url + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + endpoint.token },
    body: JSON.stringify(body),
  });
  return response.ok ? JSON.parse(response.text) : { error: 'http-' + response.status };
}

const ended = 'NCF wake notice from an ended session lifecycle. Messages stay unread.';

// Why the notice must not start a turn now, or null when it may.
async function check($, own) {
  if (!own || own.ended) return ended;
  await own.loading;
  const sessionId = await $.session.id();
  if (own.ended || lifecycle !== own) return ended;
  if (!own.endpoint) return 'NCF wake notice withdrawn: no node. Messages stay unread.';
  const answer = await post($, own.endpoint, '/first-wake/start', { sessionId });
  const verdict =
    own.ended || lifecycle !== own
      ? 'fenced'
      : answer.started === true
        ? 'started'
        : 'claim:' + String(answer.reason ?? 'refused');
  try {
    await post($, own.endpoint, '/first-wake/result', {
      sessionId,
      claim: null,
      outcome: 'gate:' + verdict,
    });
  } catch {
    // Evidence only.
  }
  if (verdict === 'started') return null;
  return verdict === 'fenced'
    ? ended
    : 'NCF wake notice withdrawn: ' + verdict + '. Messages stay unread.';
}
