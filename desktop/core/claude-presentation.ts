// Static Claude Code modules, bundled into the application and published by
// claudePluginFiles. No source checkout or runtime secret is read here.
// Formatter provenance: reviewed research 6db26af; registration: reviewed 437c5f5.
export const claudePresentationFiles = {
  'plugin/hooks/incoming-format.js': String.raw`// Isolated presentation only. These functions never read inboxes or change receipt.
export const ownRead = 'mcp__plugin_ncf-agent-interconnect_ncf__agent_read';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const string = (v) => typeof v === 'string';
const attachment = (v) =>
  object(v) &&
  string(v.id) &&
  /^[a-f0-9]{64}$/.test(v.id) &&
  string(v.name) &&
  v.name.length > 0 &&
  v.name.length <= 255 &&
  !/[\\/\x00-\x1f]/.test(v.name) &&
  integer(v.size) &&
  v.size <= 100 * 1024 * 1024;
const actualId = (v) => string(v) && v.trim().length > 0;

export function hasOwnReadIdentity(e) {
  return (
    object(e) &&
    object(e.props) &&
    e.props.tool === ownRead &&
    actualId(e.requestId) &&
    actualId(e.props.tool_use_id) &&
    e.props.tool_use_id === e.requestId
  );
}

// Keep Unicode and line breaks; expose terminal controls instead of executing them.
export const printable = (v) =>
  String(v).replace(
    /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );

function parse(text) {
  if (!string(text) || text.length > 8 * 1024 * 1024) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Accept only node's page or its actual MCP text/structuredContent representation.
// Native proof must identify which of these shapes the installed host supplies.
export function pageFrom(output) {
  let value = output;
  if (object(value) && value.isError === true) return undefined;
  if (object(value) && Array.isArray(value.content)) {
    if (value.content.length !== 1 || value.content[0]?.type !== 'text') return undefined;
    const decoded = parse(value.content[0].text);
    if (
      value.structuredContent !== undefined &&
      JSON.stringify(decoded) !== JSON.stringify(value.structuredContent)
    )
      return undefined;
    value = decoded;
  }
  if (Array.isArray(value)) {
    if (value.length !== 1 || value[0]?.type !== 'text') return undefined;
    value = parse(value[0].text);
  }
  if (string(value)) value = parse(value);
  if (
    !object(value) ||
    !Array.isArray(value.messages) ||
    value.messages.length > 200 ||
    !integer(value.nextCursor) ||
    typeof value.hasMore !== 'boolean'
  )
    return undefined;
  for (const row of value.messages) {
    const e = row?.envelope;
    if (
      !object(row) ||
      row.direction !== 'in' ||
      !integer(row.sequence) ||
      !/^r[1-9a-z][0-9a-z]{0,10}$/.test(row.replyRef ?? '') ||
      !object(e) ||
      e.protocol !== 2 ||
      !uuid.test(e.id ?? '') ||
      !uuid.test(e.fromNode ?? '') ||
      !uuid.test(e.toNode ?? '') ||
      !string(e.fromNickname) ||
      !e.fromNickname ||
      !string(e.toNickname) ||
      !e.toNickname ||
      !string(e.text) ||
      !Array.isArray(e.attachments) ||
      e.attachments.length > 16 ||
      !e.attachments.every(attachment) ||
      !Array.isArray(row.files) ||
      row.files.length !== e.attachments.length
    )
      return undefined;
    // A full multiset match preserves duplicates only when both lists contain
    // them. One file cannot stand in for two different attachments.
    const unmatched = [...e.attachments];
    for (const file of row.files) {
      if (!attachment(file) || !string(file.localPath) || !file.localPath) return undefined;
      const match = unmatched.findIndex(
        (a) => a.id === file.id && a.name === file.name && a.size === file.size,
      );
      if (match < 0) return undefined;
      unmatched.splice(match, 1);
    }
    if (unmatched.length) return undefined;
  }
  return value;
}

export function incomingText(page) {
  if (!page.messages.length) return 'NCF Agent Interconnect: no new messages in this read.';
  const rows = page.messages.map((row) => {
    const e = row.envelope;
    const files = row.files.map(
      (file) => 'Attachment: ' + printable(file.name) + '\n' + printable(file.localPath),
    );
    return (
      'Incoming NCF Agent Interconnect\nFrom: ' +
      printable(e.fromNickname) +
      '\n\n' +
      printable(e.text) +
      (files.length ? '\n\n' + files.join('\n') : '') +
      '\n\nReply-To: ' +
      printable(row.replyRef) +
      '\nUse agent_send(connectionId, replyRef="' +
      row.replyRef +
      '", text) to reply.'
    );
  });
  return rows.join('\n\n') + (page.hasMore ? '\n\nMore incoming messages are available.' : '');
}

// Expanded view retains every page field. The exact body is already shown once
// above; do not repeat it in a second JSON dump.
export function expandedMetadata(page) {
  return (
    '\n\nReturned page metadata (message text is shown above):\n' +
    printable(
      JSON.stringify(
        {
          ...page,
          messages: page.messages.map((row) => ({
            ...row,
            envelope: { ...row.envelope, text: '[shown in Incoming above]' },
          })),
        },
        null,
        2,
      ),
    )
  );
}

export const textTree = (text) => ({ type: 'Text', children: [text] });

export function isOwnResult(props) {
  return (
    props?.tool === ownRead &&
    !props.isErrored &&
    !props.isInterrupted &&
    !props.isRunning &&
    pageFrom(props.output) !== undefined
  );
}
`,
  'plugin/hooks/incoming.js': String.raw`import {
  ownRead,
  pageFrom,
  incomingText,
  expandedMetadata,
  textTree,
  isOwnResult,
  hasOwnReadIdentity,
} from './incoming-format.js';

export function register(on) {
  // One deterministic content site: ToolUse, including unfolded groups and ctrl+o.
  // ToolResult below draws no second copy only for the same valid actual page.
  // No seen-ID state: offscreen callbacks, remount and callback order are harmless.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !hasOwnReadIdentity(e)) return next(e);
    if (e.props.isRunning) return textTree('NCF Agent Interconnect: receiving messages…');
    if (isOwnResult(e.props)) {
      const page = pageFrom(e.props.output);
      return textTree(incomingText(page));
    }
    // Host errors, refusals, interruption and unknown result schemas stay intact.
    return next(e);
  });
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !hasOwnReadIdentity(e) || !isOwnResult(e.props)) return next(e);
    // ToolUse.isExpanded includes forced group layout; this site's expansion
    // denotes the explicit full transcript. Never copy the body into diagnostics.
    return textTree(e.props.isExpanded === true ? expandedMetadata(pageFrom(e.props.output)) : '');
  });
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (
      e.surface !== 'terminal' ||
      !Array.isArray(e.props.calls) ||
      !e.props.calls.some((call) => call.tool === ownRead)
    )
      return next(e);
    return next({ ...e, props: { ...e.props, isExpanded: true } });
  });
  // Presentation only: do not alter the stored/model-facing notice or its claim hash.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const p = e.props;
    if (
      e.surface !== 'terminal' ||
      p.origin?.kind !== 'plugin' ||
      p.origin.name !== 'ncf-agent-interconnect' ||
      p.origin.asUser ||
      typeof p.text !== 'string' ||
      !/^NCF Agent Interconnect messages are waiting for agent .+ in this chat\. Call agent_read for this agent now and continue with nextCursor while hasMore is true\. This notice contains no message content\. Wake reference [a-f0-9]+\.$/.test(
        p.text,
      )
    )
      return next(e);
    return next({
      ...e,
      props: {
        ...p,
        text: 'NCF Agent Interconnect: incoming notification. Content appears after the read completes.',
      },
    });
  });
}
`,
} as const;
