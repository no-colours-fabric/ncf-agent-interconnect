import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as asar from '@electron/asar';
import { FileMatcher } from 'app-builder-lib/internal';

const require = createRequire(import.meta.url);

test('packaging dependencies preserve filters, hidden files and ASAR unpack rules', async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-packaging-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, 'source');
  const files = {
    'build/main.js': 'console.log("packaged");',
    'build/main.js.map': '{}',
    'build/.hidden': 'hidden',
    'assets/данные/config.json': '{"value":"Кириллица"}',
    'native/addon.node': 'native fixture',
  };
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(source, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }

  const filter = new FileMatcher(source, path.join(temporary, 'output'), (value) => value, [
    'build/**/*',
    '!**/*.map',
  ]).createFilter();
  for (const [relative, included] of [
    ['build/main.js', true],
    ['build/.hidden', true],
    ['build/main.js.map', false],
    ['assets/данные/config.json', false],
  ] as const) {
    const file = path.join(source, relative);
    assert.equal(filter(file, await stat(file)), included, relative);
  }

  const { FileList } = require('filelist');
  const list = new FileList();
  list.include(path.join(source, 'build', '*.js').replaceAll('\\', '/'), {
    windowsPathsNoEscape: true,
  });
  assert.deepEqual(
    list.toArray().map((file: string) => path.basename(file)),
    ['main.js'],
  );

  const archive = path.join(temporary, 'application.asar');
  await asar.createPackageWithOptions(source, archive, {
    unpack: '*.node',
    unpackDir: 'assets/данные',
  });
  const entries = asar
    .listPackage(archive, { isPack: false })
    .map((entry) => entry.replaceAll('\\', '/'));
  assert.ok(entries.includes('/build/.hidden'));
  for (const [relative, contents] of Object.entries(files))
    assert.equal(
      asar.extractFile(archive, path.normalize(relative)).toString(),
      contents,
      relative,
    );
  assert.equal(asar.statFile(archive, path.join('native', 'addon.node')).unpacked, true);
  assert.equal(asar.statFile(archive, path.join('assets', 'данные', 'config.json')).unpacked, true);
  assert.equal(
    await readFile(path.join(archive + '.unpacked', 'native/addon.node'), 'utf8'),
    files['native/addon.node'],
  );
});
