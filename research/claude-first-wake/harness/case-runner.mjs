// Experiment harness: runs several native cases in one resumed session. For each
// case it waits for its trigger (the owner's own prompt, or a draft), queues one
// probe, optionally arms the fixture, and appends one comment line to the
// candidate hooks module so that --plugin-dir reloads it and fires session.start
// at that moment. The module logic is unchanged; the original bytes are restored
// when the session exits. Usage: node case-runner.mjs <modDir> <cases.json>
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const [modDir, casesFile] = process.argv.slice(2);
const home = process.env.NCF_RESEARCH_HOME ?? process.env.HOME + '/ncf-readiness';
const journal = home + '/node/first-wake-journal.jsonl';
const moduleFile = modDir + '/hooks/register.js';
const original = await readFile(moduleFile);
const cases = JSON.parse(await readFile(casesFile, 'utf8'));
const log = (entry) =>
  appendFile(
    home + '/journal/case-runner.log',
    JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n',
  );
const send = async (text) => {
  const { stdout } = await run(
    'node',
    [new URL('./send.mjs', import.meta.url).pathname, 'rr-Борис', text],
    {
      env: { ...process.env, NCF_NODE_FILE: home + '/node/Integrations/node.json' },
    },
  );
  await appendFile(home + '/journal/sends.jsonl', stdout);
  return JSON.parse(stdout).id;
};
const control = (route, body) =>
  run('node', [new URL('./control.mjs', import.meta.url).pathname, route, JSON.stringify(body)]);
const events = async (after) =>
  (await readFile(journal, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .filter((event) => event.at > after);
const pause = () => new Promise((resolve) => setTimeout(resolve, 150));
const trigger = {
  owner: (e) => e.native === 'prompt.submit' && e.wakeNotice === false && e.origin === 'engine',
  draft: (e) => e.native === 'draft' && e.present === true && e.command === false,
  command: (e) => e.native === 'draft' && e.present === true && e.command === true,
  read: (e) => e.native === 'tool.check' && /agent_read$/.test(e.tool),
};
const exited = (list) => list.some((e) => e.native === 'session.end' && e.reason !== 'clear');
let since = new Date().toISOString();
await log({ step: 'start', cases: cases.map((c) => c.name) });
try {
  for (const item of cases) {
    await log({ step: 'waiting', case: item.name, trigger: item.trigger });
    let fired;
    while (!(fired = (await events(since)).find(trigger[item.trigger]))) {
      if (exited(await events(since))) throw new Error('session exited');
      await pause();
    }
    since = fired.at;
    if (!item.reload) {
      await log({ step: 'observed', case: item.name, at: fired.at });
      continue;
    }
    const probe = await send('R2 ' + item.name + ' probe: pending before the reload');
    if (item.arm) await control(item.arm.route, item.arm.body);
    const reloadAt = new Date().toISOString();
    await appendFile(moduleFile, '// reload ' + item.name + ' ' + reloadAt + '\n');
    await log({ step: 'reloaded', case: item.name, triggerAt: fired.at, probe, reloadAt });
    let after = false;
    for (;;) {
      const list = await events(reloadAt);
      if (item.after && !after && list.some((e) => e.event === 'claim-consume' && e.ok)) {
        after = await send('R2 ' + item.name + ' probe: arrives after the claim');
        await log({ step: 'sent-after-consume', case: item.name, probe: after });
      }
      // The candidate's own outcome for this lifecycle, not the gate's report.
      const result = list.find(
        (e) => e.event === 'mod-result' && !String(e.outcome).startsWith('gate:'),
      );
      if (result) {
        await log({ step: 'case-result', case: item.name, outcome: result.outcome, at: result.at });
        since = result.at;
        break;
      }
      if (exited(list)) throw new Error('session exited');
      await pause();
    }
  }
  while (!exited(await events(since))) await pause();
} catch (error) {
  await log({ step: 'stopped', reason: String(error.message) });
} finally {
  await writeFile(moduleFile, original);
  await log({ step: 'restored' });
}
