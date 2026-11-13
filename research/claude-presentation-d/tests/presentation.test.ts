import { expect, test } from 'claude-code/testing';
import { ownRead, pageFrom, incomingText, printable } from '../hooks/presentation.js';

const page = () => ({
  messages: [
    {
      direction: 'in',
      sequence: 1,
      replyRef: 'r1',
      files: [],
      envelope: {
        protocol: 2,
        id: '00000000-0000-4000-8000-000000000001',
        fromNode: '00000000-0000-4000-8000-000000000002',
        toNode: '00000000-0000-4000-8000-000000000003',
        fromNickname: 'Боб 漢字',
        toNickname: 'Борис',
        text: 'D-PROBE-001\nТочный текст 漢字',
        attachments: [],
      },
    },
  ],
  nextCursor: 1,
  hasMore: false,
});
const props = (extra = {}) => ({
  tool: ownRead,
  tool_use_id: 'fixture-call',
  input: {},
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  output: page(),
  ...extra,
});
const event = (component, p) => ({
  surface: 'terminal',
  component,
  plugin: 'ncf-agent-interconnect',
  requestId: 'fixture-call',
  props: p,
});
const native = { type: 'Text', children: ['NATIVE'] };
const fallback = (on) => on('ui.render', () => native);
// 2.1.319's render chain must be mounted by the test host. Calling $.ui.render
// directly does not exercise the plugin's actual mounted site.
async function render($, e) {
  const ui = await $.ui.mount({
    plugin: 'ncf-incoming-presentation-probe',
    surface: e.surface,
    component: e.component,
    requestId: e.requestId,
    props: e.props,
  });
  const tree = await ui.drawn();
  await ui.unmount();
  return tree;
}

test('actual MCP wrappers retain original sender body route and ID; malformed mixed data fails', () => {
  const p = page();
  for (const output of [
    p,
    JSON.stringify(p),
    [{ type: 'text', text: JSON.stringify(p) }],
    { content: [{ type: 'text', text: JSON.stringify(p) }], structuredContent: p },
  ])
    expect(incomingText(pageFrom(output))).toContain('From: Боб 漢字\n\nD-PROBE-001');
  expect(incomingText(p)).toContain('Reply-To: r1');
  expect(pageFrom({ ...p, messages: [{ ...p.messages[0], direction: 'out' }] })).toBeUndefined();
  expect(
    pageFrom({ content: [{ type: 'text', text: JSON.stringify(p) }], structuredContent: {} }),
  ).toBeUndefined();
  expect(pageFrom({ isError: true, ...p })).toBeUndefined();
});

test('ToolUse is sole content site across collapsed expanded repeat remount and reversed callbacks', async ($, on) => {
  fallback(on);
  for (const isExpanded of [false, true, false]) {
    const p = props({ isExpanded });
    const result = await render($, event('ToolResult', p));
    expect(result.children).toEqual(['']);
    const first = await render($, event('ToolUse', p));
    expect(first.children[0]).toContain('From: Боб 漢字');
    expect(first.children[0]).toContain('Точный текст 漢字');
    expect(await render($, event('ToolUse', p))).toEqual(first);
    expect(await render($, event('ToolResult', p))).toEqual(result);
    expect(first.children[0].split('D-PROBE-001').length).toBe(2);
    if (isExpanded) expect(first.children[0]).toContain('Returned page metadata');
  }
  const ui = await $.ui.mount({
    plugin: 'ncf-incoming-presentation-probe',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 'fixture-call',
    props: props(),
  });
  expect((await ui.drawn()).children[0]).toContain('Incoming NCF Agent Interconnect');
  await ui.unmount();
  const again = await $.ui.mount({
    plugin: 'ncf-incoming-presentation-probe',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 'fixture-call',
    props: props(),
  });
  expect((await again.drawn()).children[0]).toContain('Incoming NCF Agent Interconnect');
  await again.unmount();
});

test('history foreign tool surface failures and unsupported output retain native content', async ($, on) => {
  fallback(on);
  for (const extra of [
    { tool: ownRead.replace('agent_read', 'agent_history') },
    { tool: 'mcp__foreign__agent_read' },
    { isErrored: true },
    { isInterrupted: true },
    { output: { busy: true } },
    { output: { messages: [], hasMore: false } },
  ])
    for (const site of ['ToolUse', 'ToolResult'])
      expect((await render($, event(site, props(extra)))).children).toEqual(native.children);
  expect((await render($, { ...event('ToolUse', props()), surface: 'desktop' })).children).toEqual(
    native.children,
  );
  expect(
    (await render($, { ...event('ToolUse', props()), requestId: 'other-id' })).children,
  ).toEqual(native.children);
});

test('group unfolds owned call without replacing other calls or original props', async ($, on) => {
  let observed;
  on('ui.render', ($, e) => {
    observed = e;
    return native;
  });
  const calls = [props({ tool: 'Read' }), props()];
  const e = event('ToolGroup', { calls, isActive: false, isExpanded: false, isCallsOnly: true });
  await render($, e);
  expect(observed.props.isExpanded).toBe(true);
  expect(observed.props.calls).toEqual(calls);
  expect(e.props.isExpanded).toBe(false);
});

test('empty and pending states are truthful and controls never become terminal sequences', async ($, on) => {
  fallback(on);
  const empty = await render(
    $,
    event('ToolUse', props({ output: { messages: [], nextCursor: 0, hasMore: false } })),
  );
  expect(empty.children[0]).toContain('no new messages');
  const pending = await render($, event('ToolUse', props({ isRunning: true, output: undefined })));
  expect(pending.children[0]).toContain('receiving');
  expect(printable('Боб\u001b[31m\n漢字')).toBe('Боб\\u001b[31m\n漢字');
});

test('wake display rewrite preserves origin and human/foreign input unchanged', async ($, on) => {
  let observed;
  on('ui.render', ($, e) => {
    observed = e;
    return native;
  });
  const p = {
    text: 'NCF Agent Interconnect messages are waiting for agent "Борис" in this chat. Call agent_read for this agent now and continue with nextCursor while hasMore is true. This notice contains no message content. Wake reference abc123.',
    origin: { kind: 'plugin', name: 'ncf-agent-interconnect' },
    isExpanded: false,
    onScreen: null,
  };
  await render($, event('UserMessage', p));
  expect(observed.props.text).toContain('incoming notification');
  expect(observed.props.origin).toEqual(p.origin);
  expect(observed.props.onScreen).toBeNull();
  expect(p.text).toContain('Call agent_read');
  for (const origin of [
    { kind: 'composer' },
    { kind: 'plugin', name: 'foreign' },
    { kind: 'plugin', name: 'ncf-agent-interconnect', asUser: true },
  ]) {
    const other = { ...p, origin };
    await render($, event('UserMessage', other));
    expect(observed.props).toEqual(other);
  }
});
