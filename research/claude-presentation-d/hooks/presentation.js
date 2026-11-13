// Isolated presentation only. These functions never read inboxes or change receipt.
export const ownRead = 'mcp__plugin_ncf-agent-interconnect_ncf__agent_read';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const string = (v) => typeof v === 'string';

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
      !Array.isArray(row.files) ||
      row.files.length !== e.attachments.length
    )
      return undefined;
    for (const file of row.files) {
      if (
        !object(file) ||
        !string(file.name) ||
        !string(file.localPath) ||
        !integer(file.size) ||
        !/^[a-f0-9]{64}$/.test(file.id ?? '') ||
        !e.attachments.some((a) => a.id === file.id && a.name === file.name && a.size === file.size)
      )
        return undefined;
    }
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
      '\nMessage ID: ' +
      e.id
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
