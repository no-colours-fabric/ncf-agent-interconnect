import { expect, test } from 'claude-code/testing';

const settle = async () => {
  for (let i = 0; i < 2000; i++) await Promise.resolve();
};

function fixture(
  on,
  answer: () => Promise<Record<string, unknown>> | Record<string, unknown>,
  drop?: string,
) {
  const submitted: string[] = [];
  const reports: Record<string, unknown>[] = [];
  const requests: string[] = [];
  on('session.start', ($, e) => e);
  on('session.end', ($, e) => e);
  on('session.id', () => ({ value: 'b5e1a3f2-0000-4000-8000-000000000001' }));
  on('env.get', () => ({ value: '/fixture/research-first-wake.json' }));
  on('fs.read', () => ({ value: JSON.stringify({ url: 'http://127.0.0.1:1', token: 'fixture' }) }));
  on('http.fetch', async ($, e) => {
    requests.push(e.url);
    if (String(e.url).endsWith('/first-wake/result')) {
      reports.push(JSON.parse(e.init.body));
      return { value: { status: 200, ok: true, headers: {}, text: '{}' } };
    }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(await answer()) } };
  });
  on('prompt.submit', ($, e) => {
    submitted.push(e.text);
    return drop ? { drop } : { text: e.text };
  });
  return { submitted, reports, requests };
}

test('a pending message on a proven route submits one fixed attributed notice', async ($, on) => {
  const f = fixture(on, () => ({ wake: true, nickname: 'Боб "漢字"', ticket: 't1' }));
  await $.session.start({ cwd: '/fixture' });
  await settle();
  expect(f.submitted.length).toBe(1);
  expect(f.submitted[0]).toContain('"Боб \\"漢字\\""');
  expect(f.submitted[0]).toContain('agent_read');
  expect(f.submitted[0]).toContain('no message content');
  expect(f.reports).toEqual([
    { sessionId: 'b5e1a3f2-0000-4000-8000-000000000001', ticket: 't1', outcome: 'turn-started' },
  ]);
});

test('no pending message, a deadline or an invalid name submits nothing', async ($, on) => {
  const answers = [
    { wake: false, reason: 'deadline', ticket: null },
    { wake: true, nickname: 'line\nbreak', ticket: 't2' },
  ];
  const f = fixture(on, () => answers.shift()!);
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await $.session.start({ cwd: '/fixture' });
  await settle();
  expect(f.submitted.length).toBe(0);
  expect(f.reports.map((r) => r.outcome)).toEqual([
    'not-submitted:deadline',
    'not-submitted:no-wake',
  ]);
});

test('a session end before the answer fences the scope', async ($, on) => {
  let release: (value: Record<string, unknown>) => void = () => {};
  const f = fixture(on, () => new Promise((resolve) => (release = resolve)));
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await $.session.end({
    cwd: '/fixture',
    sessionId: 'b5e1a3f2-0000-4000-8000-000000000001',
    reason: 'resume',
  });
  release({ wake: true, nickname: 'Боб', ticket: 't3' });
  await settle();
  expect(f.submitted.length).toBe(0);
  expect(f.reports.map((r) => r.outcome)).toEqual(['fenced']);
});

test('a dropped submission is reported once and never retried', async ($, on) => {
  const drop = 'the prompt was removed from the queue before it ran';
  on('turn.complete', ($, e) => ({ text: '' }));
  const f = fixture(on, () => ({ wake: true, nickname: 'Боб', ticket: 't4' }), drop);
  await $.session.start({ cwd: '/fixture' });
  await settle();
  await $.turn.complete({ cwd: '/fixture', answer: '', text: '' });
  await settle();
  expect(f.submitted.length).toBe(1);
  expect(f.reports.map((r) => r.outcome)).toEqual(['dropped:' + drop]);
});
