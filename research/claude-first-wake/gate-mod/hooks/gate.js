// Research prototype, not a product component. The start check for the
// ncf-first-wake-research notice. A mod's own hooks never see its own
// $.prompt.submit, and a prompt submitted by one mod reaches the prompt.submit
// hooks of the mods that run after it, with next.origin naming the submitter
// (observed natively with Claude Code 2.1.318). Loaded after that mod, this gate
// checks the notice right before it starts a turn. It names the exact notice to
// the node by the hash of its text, so an older notice can never start a newer
// claim. The notice passes only if the node starts that claim and the lifecycle
// this gate was loaded in is still current after every await; evidence I/O
// happens before the start check or after the decision, never between them.
// Anything else, or a failed check, drops the notice. Other prompts pass unchanged.

const source = 'ncf-first-wake-research';
const prefix = 'NCF Agent Interconnect messages were already waiting for agent ';

// The current lifecycle. session.start replaces it and session.end ends it.
let lifecycle = null;

/** Whether this prompt is the first-wake notice that this gate must check. */
export function gated(origin, text) {
  return origin?.plugin === source && typeof text === 'string' && text.startsWith(prefix);
}

const current = (own) => !!own && !own.ended && lifecycle === own;

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
    const refusal = await check($, lifecycle, e.text);
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

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Evidence only: a failed report changes nothing.
async function report($, own, sessionId, outcome) {
  try {
    await post($, own.endpoint, '/first-wake/result', { sessionId, claim: null, outcome });
  } catch {
    // Ignored.
  }
}

const ended = 'NCF wake notice from an ended session lifecycle. Messages stay unread.';

// Why the notice must not start a turn now, or null when it may.
async function check($, own, text) {
  if (!current(own)) return ended;
  await own.loading;
  if (!current(own)) return ended;
  if (!own.endpoint) return 'NCF wake notice withdrawn: no node. Messages stay unread.';
  const sessionId = await $.session.id();
  if (!current(own)) return ended;
  const notice = await sha256(text);
  // Evidence before the decisive check, so no report sits between it and forwarding.
  await report($, own, sessionId, 'gate:checking');
  if (!current(own)) return ended;
  const answer = await post($, own.endpoint, '/first-wake/start', { sessionId, notice });
  // The final authorization: the node started this exact notice's claim and the
  // lifecycle is still the one that asked. No await follows before forwarding.
  const started = answer.started === true;
  const live = current(own);
  const verdict = !live
    ? 'fenced'
    : started
      ? 'started'
      : 'claim:' + String(answer.reason ?? 'refused');
  void report($, own, sessionId, 'gate:' + verdict);
  if (started && live) return null;
  if (!live) return ended;
  if (verdict === 'claim:backlog-read')
    return 'NCF wake notice withdrawn: the waiting messages were already read.';
  return 'NCF wake notice withdrawn: ' + verdict + '. Messages stay unread.';
}
