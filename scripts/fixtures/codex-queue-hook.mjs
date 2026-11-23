import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';

// Installed only in the disposable marketplace used by the delivery probe.
const endpoint = JSON.parse(await readFile(new URL('./endpoint.json', import.meta.url), 'utf8'));
const hook = JSON.parse(await text(process.stdin));
const ext = 'io.modelcontextprotocol/events';
const signal = AbortSignal.timeout(18000);
let id = 0;
function call(method, params = {}) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2026-07-28',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++id,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'ncf_fixture_hook', version: '1' },
          ...params._meta,
        },
      },
    }),
    signal,
  });
}
async function result(method, params) {
  const response = await call(method, params);
  assert(response.ok);
  const packet = await response.json();
  assert(!packet.error);
  return packet.result;
}
const args = { threadId: hook.session_id };
const state = await result('tools/call', { name: 'test_state', arguments: args });
let output = {};
if (state.content[0].text === 'armed' && hook.hook_event_name === 'Stop') {
  if (!hook.stop_hook_active) {
    const pending = await result('tools/call', { name: 'test_read_pending', arguments: args });
    if (pending.content[0].text) output = { decision: 'block', reason: pending.content[0].text };
  }
} else if (state.content[0].text === 'armed' && hook.hook_event_name === 'UserPromptSubmit') {
  const discovery = await result('server/discover');
  assert(discovery.capabilities.extensions[ext]);
  const meta = { 'io.modelcontextprotocol/clientCapabilities': { extensions: { [ext]: {} } } };
  const { events } = await result('events/list', { _meta: meta });
  assert(events.some((e) => e.name === 'ncf.message' && e.delivery.includes('push')));
  const response = await call('events/stream', {
    name: 'ncf.message',
    arguments: args,
    cursor: null,
    _meta: meta,
  });
  assert(response.ok);
  const streamId = id;
  const source = Readable.fromWeb(response.body);
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  let active = false;
  for await (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const frame = JSON.parse(line.slice(6));
    assert.equal(frame.params._meta['io.modelcontextprotocol/subscriptionId'], streamId);
    if (frame.method === 'notifications/events/active') active = true;
    if (frame.method !== 'notifications/events/event') continue;
    assert(active);
    const event = frame.params;
    assert.equal(event.name, 'ncf.message');
    assert.equal(event.data.threadId, hook.session_id);
    await result('tools/call', {
      name: 'test_hook_received',
      arguments: { ...args, eventId: event.eventId, text: event.data.text },
    });
    output = {
      systemMessage: 'NCF fixture event received.',
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: event.data.text },
    };
    break;
  }
  lines.close();
  source.destroy();
}
process.stdout.write(JSON.stringify(output));
