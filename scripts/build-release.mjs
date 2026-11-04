import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url)),
  rawArgs = process.argv.slice(2),
  skipSourceChecks = rawArgs.includes('--skip-source-checks'),
  args = rawArgs.filter((arg) => arg !== '--skip-source-checks');
for (const [flag, platform] of [
  ['--mac', 'darwin'],
  ['--win', 'win32'],
  ['--linux', 'linux'],
])
  if (args.includes(flag) && process.platform !== platform)
    throw new Error(`Build ${flag} on ${platform}: the package contains the target OS runtime.`);
const requestedArchitectures = ['arm64', 'x64'].filter((arch) => args.includes('--' + arch));
const architectures = requestedArchitectures.length
  ? requestedArchitectures
  : process.platform === 'darwin'
    ? ['arm64', 'x64']
    : [process.arch];
for (const arch of architectures)
  if (process.platform !== 'darwin' && process.arch !== arch)
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
for (const task of [
  'prepare:runtime',
  ...(skipSourceChecks ? [] : ['typecheck', 'test:desktop']),
  'build',
])
  run(npm, ['run', task]);
for (const arch of architectures) {
  const builderArgs = args.filter((arg) => !['--arm64', '--x64'].includes(arg));
  if (arch !== process.arch) {
    const config = path.join(root, '.local', `electron-${process.platform}-${arch}.json`);
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(
      config,
      JSON.stringify({ extends: path.join(root, 'electron-builder.yml'), electronDist: null }),
    );
    builderArgs.push('--config', config);
  }
  run(npm, [
    'exec',
    '--offline',
    '--no',
    '--',
    'electron-builder',
    '--publish',
    'never',
    ...builderArgs,
    '--' + arch,
  ]);
  run(path.join(root, 'scripts', 'verify-release.mjs'), ['--arch=' + arch]);
}
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
console.log('Installers and local verification files: ' + path.join(root, 'release'));
