import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultMessageDisplayContext,
  formatAgentMessagePresentation,
  formatAgentMessageTimestamp,
  validateMessageDisplayContext,
  type AgentMessagePresentationInput,
} from '../desktop/core/message-presentation.js';

const sentAt = '2026-11-17T12:34:56.000Z';
const deliveredAt = Date.UTC(2026, 10, 17, 12, 35, 7);

function input(
  changes: Partial<AgentMessagePresentationInput> = {},
): AgentMessagePresentationInput {
  return {
    fromNickname: 'Ирис "*[]"',
    sentAt,
    deliveredAt,
    locale: 'en-GB',
    timeZone: 'UTC',
    text: "Literal $& $$ $` $' {size}\nМосква 東京",
    files: [],
    replyRef: 'r60b',
    ...changes,
  };
}

test('formats canonical incoming text with fixed Sent and Delivered through seconds', () => {
  const value = formatAgentMessagePresentation(input());
  const sender = String.raw`"Ирис \\"\*\[\]\\""`;
  assert.match(value, /^\*\*Incoming NCF Agent Interconnect\*\*\n/);
  assert.ok(value.includes(`From: ${sender}`));
  assert.ok(value.includes('Sent: 17/11/2026, 12:34:56'));
  assert.ok(value.includes('Delivered: 17/11/2026, 12:35:07'));
  assert.ok(value.includes("Literal $& $$ $` $' {size}\nМосква 東京"));
  assert.ok(value.includes(`Reply-To ${sender}: r60b`));
  assert.match(value, /Use agent_send\(connectionId, replyRef="r60b", text\) to reply\./);
  assert.match(value, /own known nickname and recoverOnly=true, omitting connectionId/);
  assert.match(
    value,
    /Use binding\.connectionId only after connected\. Check history before retrying an uncertain send\.$/,
  );
  assert.doesNotMatch(value, /estimated|approximate|timeZone|UTC|GMT|\+00/i);
});

test('uses the selected locale and IANA time zone without displaying an offset', () => {
  assert.equal(
    formatAgentMessageTimestamp(sentAt, { locale: 'ru-RU', timeZone: 'Europe/Moscow' }),
    '17.11.2026, 15:34:56',
  );
  assert.deepEqual(validateMessageDisplayContext({ locale: 'EN-gb', timeZone: 'Etc/UTC' }), {
    locale: 'en-GB',
    timeZone: 'UTC',
  });
});

test('uses the runtime date format for Sent and Delivered in each regional locale', () => {
  const sentAt = '2026-11-18T05:04:06.000Z';
  const deliveredAt = Date.parse('2026-11-18T05:04:09.000Z');
  const timeZone = 'Europe/Moscow';
  for (const locale of ['en-US', 'ru-RU']) {
    const value = formatAgentMessagePresentation(input({ sentAt, deliveredAt, locale, timeZone }));
    assert.ok(value.includes(`Sent: ${new Date(sentAt).toLocaleString(locale, { timeZone })}\n`));
    assert.ok(
      value.includes(`Delivered: ${new Date(deliveredAt).toLocaleString(locale, { timeZone })}\n`),
    );
  }
  assert.equal(
    formatAgentMessageTimestamp(sentAt, defaultMessageDisplayContext()),
    new Date(sentAt).toLocaleString(),
  );
});

test('uses the OS regional locale when supported and falls back to the runtime locale', () => {
  assert.equal(defaultMessageDisplayContext('ru_RU').locale, 'ru-RU');
  assert.deepEqual(defaultMessageDisplayContext('invalid_locale'), defaultMessageDisplayContext());
  assert.equal(
    defaultMessageDisplayContext('en-US').timeZone,
    defaultMessageDisplayContext().timeZone,
  );
});

test('preserves Unicode text and escapes only Markdown names and unsafe link delimiters', () => {
  const value = formatAgentMessagePresentation(
    input({
      files: [
        {
          name: 'данные [1]* 漢字.txt',
          localPath: '/tmp/данные<1>\n漢字.txt',
        },
      ],
    }),
  );
  assert.ok(value.includes('- [данные \\[1\\]\\* 漢字.txt]'));
  assert.ok(value.includes('(<\/tmp\/данные%3C1%3E%0A漢字.txt>)'.replaceAll('\\/', '/')));
  assert.ok(value.includes("Literal $& $$ $` $' {size}\nМосква 東京"));
});

test('rejects invalid dates, display context, routing fields and attachments', () => {
  const invalid: AgentMessagePresentationInput[] = [
    input({ sentAt: 'not-a-date' }),
    input({ deliveredAt: Number.NaN }),
    input({ locale: 'not_a_locale' }),
    input({ timeZone: 'Mars/Olympus' }),
    input({ fromNickname: ' Ирис' }),
    input({ replyRef: 'message-1' }),
    input({ files: Array.from({ length: 17 }, () => ({ name: 'a.txt', localPath: '/tmp/a' })) }),
    input({ files: [{ name: 'bad/name.txt', localPath: '/tmp/a' }] }),
  ];
  for (const value of invalid) assert.throws(() => formatAgentMessagePresentation(value));
});
