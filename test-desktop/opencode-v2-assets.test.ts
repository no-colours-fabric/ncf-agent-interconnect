import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

test('v2 packaged verifier worker parses and uses original ASAR setup plus the installed standalone module', async () => {
  const script = await readFile(new URL('../scripts/verify-release.mjs', import.meta.url), 'utf8');
  const literal = /await writeFile\(\s*worker,\s*`([\s\S]*?)`\s*,?\s*\);/.exec(script)?.[1];
  assert.ok(literal);
  // Evaluate only this fixed template, with its sole known nonexecuting path interpolation.
  assert.deepEqual(
    [...literal.matchAll(/\$\{([^}]*)\}/g)].map((match) => match[1]),
    ['JSON.stringify(archive)'],
  );
  const worker = runInNewContext('`' + literal + '`', { archive: '/isolated/app.asar' }) as string;
  const parsed = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: worker,
    encoding: 'utf8',
  });
  assert.equal(parsed.status, 0, parsed.stderr);
  assert.match(worker, /packagedArchive, 'build\/core\/mcp-setup.js'/);
  assert.match(worker, /v2Directory, 'index.js'/);
  assert.match(worker, /v2Plugin.default.setup/);
  assert.match(worker, /typeof v2Cleanup, 'function'/);
  assert.match(worker, /v2Attempt.meta.phase, 'committed'/);
  assert.match(worker, /openCodeV2LiveClientTested: false/);
});
test('v2 standalone source has no checkout/core/SDK runtime dependency and the package includes all runtime boundaries', async () => {
  const source = await readFile(
    new URL('../desktop/integrations/opencode-v2.ts', import.meta.url),
    'utf8',
  );
  const imports = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith('node:')));
  const verifier = await readFile(
    new URL('../scripts/verify-release.mjs', import.meta.url),
    'utf8',
  );
  for (const filename of [
    'build/integrations/opencode-v2.js',
    'build/core/opencode-v2-adapter.js',
    'build/core/opencode-v2-auth.js',
  ])
    assert.ok(verifier.includes("entries.includes('/" + filename + "')"));
  const parsed = spawnSync(
    process.execPath,
    ['--check', new URL('../scripts/verify-release.mjs', import.meta.url).pathname],
    { encoding: 'utf8' },
  );
  assert.equal(parsed.status, 0, parsed.stderr);
});
