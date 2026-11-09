import { expect, test } from 'claude-code/testing';
import { gated } from '../hooks/gate.js';

// The kit fires $.prompt.submit as the engine and cannot fire it as another
// mod, so the gated path is verified natively; these tests pin what is local.
const notice =
  'NCF Agent Interconnect messages were already waiting for agent "Боб" when this session started.';

test('only the research mod notice is gated', () => {
  expect(gated({ plugin: 'ncf-first-wake-research', tier: 'user' }, notice)).toBe(true);
  expect(gated({ plugin: 'engine', tier: 'core' }, notice)).toBe(false);
  expect(gated({ plugin: 'another-mod', tier: 'user' }, notice)).toBe(false);
  expect(gated({ plugin: 'ncf-first-wake-research', tier: 'user' }, 'an ordinary prompt')).toBe(
    false,
  );
  expect(gated(undefined, notice)).toBe(false);
});

test('owner prompts, including one with the notice text, pass unchanged', async ($, on) => {
  const delivered: string[] = [];
  on('session.start', ($, e) => e);
  on('env.get', () => ({ value: undefined }));
  on('prompt.submit', ($, e) => {
    delivered.push(e.text);
    return { text: e.text };
  });
  await $.session.start({ cwd: '/fixture' });
  await $.prompt.submit({ text: 'an ordinary owner prompt' });
  await $.prompt.submit({ text: notice });
  expect(delivered).toEqual(['an ordinary owner prompt', notice]);
});
