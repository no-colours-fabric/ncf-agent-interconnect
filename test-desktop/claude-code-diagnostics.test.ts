import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { traceClaude } from '../desktop/integrations/claude-diagnostics.js';

test('Claude diagnostics hash identities and omit content, capabilities and raw errors', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-trace-'));
  try {
    const nodeFile = path.join(directory, 'node.json');
    traceClaude(nodeFile, 'helper.spawn', {
      session: 'private-session-漢字',
      helper: 'private-helper',
      attempt: 'private-attempt',
      request: 42,
      phase: 'validate',
      outcome: 'withheld',
      count: 3,
      ...({ text: 'SECRET MESSAGE', token: 'SECRET TOKEN', error: '/private/path' } as object),
    });
    traceClaude(nodeFile, 'helper.failure', { outcome: 'SECRET /private/path with spaces' });
    const data = await readFile(path.join(directory, 'Diagnostics', 'claude-code.jsonl'), 'utf8');
    for (const secret of [
      'private-session',
      'private-helper',
      'private-attempt',
      'SECRET',
      '/private/path',
    ])
      assert.ok(!data.includes(secret));
    const rows = data
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.match(rows[0].session, /^[a-f0-9]{20}$/);
    assert.equal(rows[0].outcome, 'withheld');
    assert.equal(rows[0].count, 3);
    assert.equal(rows[1].outcome, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Claude diagnostics refuse redirected files and never affect the caller', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-trace-link-'));
  try {
    await mkdir(path.join(directory, 'Diagnostics'), { mode: 0o700 });
    const target = path.join(directory, 'never-create');
    await symlink(target, path.join(directory, 'Diagnostics', 'claude-code.jsonl'));
    assert.doesNotThrow(() => traceClaude(path.join(directory, 'node.json'), 'helper.spawn'));
    await assert.rejects(readFile(target), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
