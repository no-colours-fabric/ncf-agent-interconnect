// Research instrumentation, not a candidate component. It reports native
// events to the isolated fixture node so experiments can correlate them and
// release owner-armed barriers on an event instead of a timer. Every hook passes
// its event on unchanged, never waits for the report and never sends prompt or
// draft text, only whether a draft is present and whether a prompt is the NCF
// wake notice.

let endpoint = null;
let draft = false;

function send($, event, detail) {
  if (!endpoint) return;
  // Not awaited: an observer never holds the event it reports.
  $.session
    .id()
    .then((sessionId) =>
      $.http.fetch(endpoint.url + '/fixture/observe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + endpoint.token },
        body: JSON.stringify({ sessionId, event, detail }),
      }),
    )
    .catch(() => {});
}

async function load($) {
  const file = await $.env.get('NCF_FIRST_WAKE_DESCRIPTOR');
  if (!file) return;
  const value = JSON.parse(await $.fs.read(file));
  if (typeof value.url === 'string' && typeof value.token === 'string') endpoint = value;
}

const wake = (text) =>
  typeof text === 'string' &&
  text.startsWith('NCF Agent Interconnect messages were already waiting for agent ');

export function register(on) {
  on('session.start', ($, e, next) => {
    load($)
      .then(() => send($, 'session.start', {}))
      .catch(() => {});
    return next(e);
  });
  on('session.end', ($, e, next) => {
    send($, 'session.end', { reason: String(e.reason) });
    return next(e);
  });
  on('turn.start', ($, e, next) => {
    send($, 'turn.start', {});
    return next(e);
  });
  on('turn.complete', ($, e, next) => {
    send($, 'turn.complete', { isAborted: !!e.isAborted, subagent: e.agentId !== undefined });
    return next(e);
  });
  on('prompt.submit', ($, e, next) => {
    send($, 'prompt.submit', { wakeNotice: wake(e.text), origin: String(next.origin?.plugin) });
    return next(e);
  });
  on('prompt.edit', async ($, e, next) => {
    // next(e) resolves to the box the editor shows after this edit.
    const box = await next(e);
    const present = typeof box?.text === 'string' && box.text.length > 0;
    if (present !== draft) {
      draft = present;
      send($, 'draft', { present });
    }
    return box;
  });
  on('tool.check', async ($, e, next) => {
    const decided = await next(e);
    send($, 'tool.check', { tool: String(e.tool), decision: String(decided?.decision) });
    return decided;
  });
  on('tool.call', ($, e, next) => {
    if (e.tool === 'AskUserQuestion') send($, 'question', {});
    return next(e);
  });
}
