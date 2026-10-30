import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url)),
  args = process.argv.slice(2),
  require = createRequire(import.meta.url);
for (const [flag, platform] of [
  ['--mac', 'darwin'],
  ['--win', 'win32'],
  ['--linux', 'linux'],
])
  if (args.includes(flag) && process.platform !== platform)
    throw new Error(`Build ${flag} on ${platform}: the package contains the target OS runtime.`);
for (const arch of ['arm64', 'x64'])
  if (args.includes('--' + arch) && process.arch !== arch)
    throw new Error(
      'This builder uses the verified runtime for the current architecture: ' + process.arch,
    );
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run npm run build:release');
function run(script, argv) {
  const result = spawnSync(process.execPath, [script, ...argv], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const task of ['prepare:runtime', 'typecheck', 'test:desktop', 'build'])
  run(npm, ['run', task]);
const builderPackage = require.resolve('electron-builder/package.json'),
  builder = JSON.parse(await readFile(builderPackage, 'utf8'));
run(
  path.resolve(
    path.dirname(builderPackage),
    typeof builder.bin === 'string' ? builder.bin : builder.bin['electron-builder'],
  ),
  ['--publish', 'never', ...args],
);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const artifactPrefix = pkg.productName.replaceAll(' ', '-') + '-' + pkg.version + '-';
const artifacts = (await readdir(path.join(root, 'release'))).filter(
  (name) => name.startsWith(artifactPrefix) && /\.(dmg|zip|exe|AppImage)$/.test(name),
);
const checksums = [];
for (const name of artifacts.sort()) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path.join(root, 'release', name))) hash.update(chunk);
  checksums.push(hash.digest('hex') + '  ' + name);
}
await writeFile(path.join(root, 'release', 'SHA256SUMS'), checksums.join('\n') + '\n');
run(path.join(root, 'scripts', 'verify-release.mjs'), []);
console.log('User packages, README and SHA256SUMS: ' + path.join(root, 'release'));
