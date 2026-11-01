import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
import {
  AgentClearFlow,
  agentCacheKey,
  invalidatedAgent,
  visibleAgentHistory,
} from '../desktop/renderer/agent-clear-model.js';
import { AgentClearControls, AgentClearSummary } from '../desktop/renderer/AgentClearControls.js';
import { t } from '../desktop/renderer/i18n/index.js';
import type {
  AgentClearPreview,
  AgentClearResponse,
  AgentIdentity,
} from '../desktop/shared/contracts.js';

const makePreview = (count = 1): AgentClearPreview => ({
  status: 'confirmation_required',
  operationId: randomUUID(),
  scope: 'agent',
  targets: [{ nickname: 'Филипп <$&>', messageCount: count }],
  agentCount: 1,
  messageCount: count,
  expiresAt: new Date(Date.now() + 600000).toISOString(),
});
const result = {
  status: 'cleared' as const,
  scope: 'agent' as const,
  agentCount: 1,
  messageCount: 1,
  limits: 'Local only',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('Cancel and navigation abandon previews without a confirm; late preview cannot reopen a cancelled dialog', async () => {
  const pending = deferred<AgentClearResponse>(),
    calls: unknown[] = [];
  const flow = new AgentClearFlow(async (input) => {
    calls.push(input);
    return pending.promise;
  });
  const loading = flow.begin({ scope: 'agent', nickname: 'Филипп' });
  assert.equal(flow.getSnapshot().busy, 'preview');
  flow.cancel();
  pending.resolve(makePreview());
  await loading;
  assert.equal(flow.getSnapshot().open, false);
  assert.equal(flow.getSnapshot().preview, null);
  assert.equal(calls.length, 1);
  assert.equal(await flow.confirm(), null);
});

test('changed preview refreshes names/count and requires a new human click; never auto-confirms', async () => {
  const calls: { confirm?: boolean; operationId?: string }[] = [],
    first = makePreview(),
    second = makePreview(2);
  const flow = new AgentClearFlow(async (input) => {
    calls.push(input);
    if (calls.length === 1) return first;
    if (calls.length === 2) throw new Error('clear_preview_stale: new message');
    if (calls.length === 3) return second;
    return result;
  });
  await flow.begin({ scope: 'agent', nickname: 'Филипп' });
  assert.equal(await flow.confirm(), null);
  assert.equal(flow.getSnapshot().stale, true);
  assert.equal(flow.getSnapshot().preview!.messageCount, 2);
  assert.equal(calls.filter((input) => input.confirm).length, 1);
  assert.equal((await flow.confirm())!.status, 'cleared');
  assert.equal(calls[3].operationId, second.operationId);
  assert.equal(flow.getSnapshot().open, false);
});

test('Electron IPC errors refresh stale or expired previews without automatically confirming again', async () => {
  for (const reason of ['stale', 'expired']) {
    const first = makePreview(),
      second = makePreview(3);
    const calls: { confirm?: boolean; operationId?: string }[] = [];
    const flow = new AgentClearFlow(async (input) => {
      calls.push(input);
      if (calls.length === 1) return first;
      if (input.confirm)
        throw new Error(
          "Error invoking remote method 'interconnect:call': Error: clear_preview_" +
            reason +
            ': request another preview',
        );
      return second;
    });
    await flow.begin({ scope: 'agent', nickname: 'Филипп' });
    assert.equal(await flow.confirm(), null);
    assert.equal(flow.getSnapshot().stale, true);
    assert.equal(flow.getSnapshot().preview?.operationId, second.operationId);
    assert.equal(flow.getSnapshot().preview?.messageCount, 3);
    assert.equal(calls.filter((input) => input.confirm).length, 1);
    flow.cancel();
    assert.equal(flow.getSnapshot().open, false);
  }
});

test('confirm has no success before server admission; Cancel cannot imply rollback of an already confirmed request', async () => {
  const pending = deferred<AgentClearResponse>();
  const flow = new AgentClearFlow(async (input) =>
    input.confirm ? pending.promise : makePreview(),
  );
  await flow.begin({ scope: 'agent', nickname: 'Филипп' });
  const confirming = flow.confirm();
  flow.cancel();
  assert.equal(flow.getSnapshot().busy, 'confirm');
  assert.equal(flow.getSnapshot().open, true);
  assert.equal(await flow.confirm(), null);
  pending.resolve(result);
  assert.equal((await confirming)!.status, 'cleared');
  assert.equal(flow.getSnapshot().open, false);
});

test('external MCP deletion and same-name recreation invalidate selected/remote sources and stale history responses', () => {
  const old: AgentIdentity = {
    nickname: 'Филипп',
    key: 'филипп',
    incarnation: randomUUID(),
    binding: null,
    messageCount: 1,
    unread: 1,
  };
  const fresh = { ...old, incarnation: randomUUID(), messageCount: 0, unread: 0 };
  const cache = {
    owner: agentCacheKey(old)!,
    messages: ['old message'],
    nextCursor: 1,
    hasMore: false,
  };
  assert.equal(invalidatedAgent([old], [], 'ФИЛИПП'), true);
  assert.equal(invalidatedAgent([old], [fresh], 'Филипп'), true);
  assert.equal(invalidatedAgent([old], [old], 'Филипп'), false);
  assert.deepEqual(visibleAgentHistory(cache, agentCacheKey(undefined)).messages, []);
  assert.deepEqual(visibleAgentHistory(cache, agentCacheKey(fresh)).messages, []);
  assert.deepEqual(visibleAgentHistory(cache, agentCacheKey(old)).messages, ['old message']);
});

test('Local toolbar states destructive agent+history scope; confirmation renders real names/count and no internal IDs', () => {
  const identity: AgentIdentity = {
    nickname: 'Филипп',
    key: 'филипп',
    incarnation: randomUUID(),
    binding: null,
    messageCount: 2,
    unread: 0,
  };
  const toolbar = renderToStaticMarkup(
    React.createElement(AgentClearControls, {
      agents: [identity],
      selected: 'Филипп',
      locale: 'en',
      invoke: async () => makePreview(),
      onCleared: () => {
        throw new Error('No server confirmation');
      },
    }),
  );
  assert.ok(toolbar.includes(t('en', 'clearSelectedAgent')));
  assert.ok(toolbar.includes(t('en', 'clearAllLocalAgents')));
  const p = makePreview(2);
  const summary = renderToStaticMarkup(
    React.createElement(AgentClearSummary, {
      locale: 'en',
      state: {
        open: true,
        busy: null,
        input: { scope: 'agent', nickname: p.targets[0].nickname },
        preview: p,
        stale: true,
        error: '',
      },
    }),
  );
  assert.ok(summary.includes('Филипп &lt;$&amp;&gt;'));
  assert.ok(summary.includes('2 messages'));
  assert.ok(summary.includes('cannot be undone'));
  assert.ok(summary.includes(t('en', 'clearPreviewStale')));
  assert.ok(!summary.includes(p.operationId));
  assert.ok(!summary.includes(identity.incarnation!));
});
