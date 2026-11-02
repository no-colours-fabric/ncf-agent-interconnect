import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { AionUiError } from '../../desktop/core/aionui-api.js';
import { aionFixture } from '../aionui-fixture.js';
import { ownStdio, temporaryNode } from '../aionui-lifecycle.js';

const phases = ['partial-startup', 'held-pair', 'held-proxy', 'early-abort', 'cleanup-deadline'];
function leaves(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(leaves) : [error];
}
function first(error: unknown): unknown {
  return error instanceof AggregateError ? first(error.errors[0]) : error;
}
for (const phase of phases) {
  test('controlled AionUi failure ' + phase, { timeout: 20000 }, async (t) => {
    const original = new Error('Injected AionUi original failure ' + phase);
    const cleanups: (() => Promise<void>)[] = [];
    const context = { after: (close: () => Promise<void>) => cleanups.push(close) };
    let snapshot: (() => Record<string, unknown>) | undefined;
    let helperExited: (() => boolean) | undefined;
    const directories: string[] = [];
    t.after(async () => {
      const results = await Promise.allSettled(cleanups.reverse().map((close) => close()));
      for (const result of results)
        if (result.status === 'rejected') {
          assert.equal(
            first(result.reason),
            original,
            'Cleanup must retain the original failure first',
          );
          if (phase === 'cleanup-deadline') {
            assert.match(String(result.reason), /cleanup failed/);
            const deadline = leaves(result.reason).find(
              (error) =>
                error instanceof Error &&
                error.message === 'AionUi fixture held consumer cleanup timed out',
            );
            assert.ok(deadline, 'The actual cleanup deadline must remain in AggregateError');
            t.diagnostic('cleanup-deadline-preserved ' + (deadline as Error).message);
          } else assert.equal(result.reason, original, 'No additional cleanup failure is expected');
        }
      const counts = snapshot!();
      for (const key of [
        'operations',
        'gates',
        'handlers',
        'proxyRequests',
        'proxyResponses',
        'proxySockets',
        'tcpSockets',
        'webSockets',
      ])
        assert.equal(counts[key], 0, key + ' must drain');
      assert.equal(counts.coreListening, false);
      assert.equal(counts.webuiListening, false);
      if (helperExited) assert.equal(helperExited(), true, 'The owned MCP helper must exit');
      for (const directory of directories)
        await assert.rejects(access(directory), { code: 'ENOENT' });
      t.diagnostic('cleanup-complete ' + phase + ' ' + JSON.stringify(counts));
      // The scenario already failed; cleanup errors are never converted into success.
      for (const result of results) if (result.status === 'rejected') throw result.reason;
    });
    try {
      const f = await aionFixture(context, {
        inspect: (read) => {
          snapshot = read;
        },
        afterCoreListen:
          phase === 'partial-startup'
            ? async () => {
                assert.equal(snapshot!().coreListening, true);
                throw original;
              }
            : undefined,
      });
      let pending: Promise<unknown> | undefined;
      await f.scope.run(async () => {
        const node = await temporaryNode(f.scope, 'ncf-aion-failure-');
        directories.push(node.directory);
        await node.aionui.pair({ url: f.url, code: f.code });
        const previous = node.aionui.current().id;
        f.scope.file({
          label: 'original authorization assertion',
          close: async () => {
            const saved = JSON.parse(
              await readFile(path.join(node.directory, 'aionui-credentials.json'), 'utf8'),
            );
            assert.equal(saved.id, previous);
          },
        });
        const expected = (error: unknown) =>
          f.scope.closing &&
          error instanceof AionUiError &&
          error.message === 'The local AionUi API is unavailable.';
        if (phase === 'held-pair') {
          const gate = f.holdPair();
          pending = f.scope.watch(
            'pending owner Pair',
            node.aionui.pair({ url: f.url, code: f.code }),
            expected,
          );
          await gate.entered;
          assert.equal(node.aionui.current().id, previous);
        } else {
          const client = new Client({ name: 'owned-failure-regression', version: 'fixture' });
          const transport = new StdioClientTransport({
            command: process.execPath,
            args: [
              '--import',
              'tsx',
              fileURLToPath(new URL('../../desktop/integrations/aionui.ts', import.meta.url)),
              '--node-file',
              path.join(node.directory, 'Integrations', 'node.json'),
            ],
            env: {
              ...getDefaultEnvironment(),
              AIONUI_BASE_URL: f.coreUrl,
              AIONUI_USER_ID: f.state.userId,
              AIONUI_CONVERSATION_ID: 'fixture-chat-a',
              AIONUI_RUNTIME_TOKEN: f.runtimeToken,
            },
            stderr: 'pipe',
          });
          helperExited = ownStdio(f.scope, client, transport);
          let stderr = '';
          transport.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
          });
          f.scope.file({
            label: 'stdio privacy assertion',
            close: async () => {
              assert.ok(!stderr.includes(f.runtimeToken));
              assert.ok(!stderr.includes(f.session));
            },
          });
          await f.scope.start('owned stdio connect', () => client.connect(transport));
          const binding = await client.callTool({
            name: 'agent_connect',
            arguments: { nickname: 'Synthetic child' },
          });
          assert.ok(!binding.isError);
          if (phase === 'cleanup-deadline') {
            let release!: () => void;
            const blocked = new Promise<void>((resolve) => {
              release = resolve;
            });
            f.scope.consumer({
              label: 'held consumer cleanup',
              close: () => blocked,
              budget: 50,
              force: release,
            });
          } else {
            const gate = f.holdProxy();
            const controller = f.scope.controller();
            pending = f.scope.watch(
              'pending proxied API',
              node.aionui
                .access(previous)
                .http.request('/api/conversations/fixture-chat-a', {}, controller.signal),
              (error) =>
                controller.signal.aborted &&
                error instanceof AionUiError &&
                error.message === 'The local AionUi API is unavailable.',
            );
            await gate.entered;
            assert.ok(f.snapshot().proxyRequests > 0);
            assert.ok(f.snapshot().handlers > 0);
            if (phase === 'early-abort') {
              controller.abort();
              await assert.rejects(pending, /local AionUi API is unavailable/);
            }
          }
        }
        throw original;
      });
      assert.fail('The injected error must fail the scenario');
    } catch (error) {
      assert.equal(first(error), original, 'Preserve the original error before cleanup errors');
      if (phase === 'cleanup-deadline') assert.match(String(error), /scenario and cleanup failed/);
      t.diagnostic('original-error-preserved ' + phase + ' ' + original.message);
      throw error;
    }
  });
}
