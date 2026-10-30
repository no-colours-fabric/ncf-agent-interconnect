import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert.equal(
    process.env.GITHUB_REF_NAME,
    'v' + pkg.version,
    'Release tag must match package.json',
  );
}
console.log(`Release version: ${pkg.version}`);
