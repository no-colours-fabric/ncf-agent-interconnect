import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Build-time status metadata only. Launch/create still hash the actual files.
export default async function writeLauncherIdentity(context) {
  if (context.electronPlatformName !== 'win32') return;
  const resources = path.join(context.appOutDir, 'resources');
  const archive = path.join(resources, 'app.asar');
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(archive)) digest.update(bytes);
  const helper = async (name) =>
    createHash('sha256')
      .update(await readFile(path.join(resources, 'app.asar.unpacked/build/assets', name + '.exe')))
      .digest('hex');
  await writeFile(
    path.join(resources, 'ncf-launcher-identity.json'),
    JSON.stringify({
      version: 1,
      asarBytes: (await stat(archive)).size,
      asarHash: digest.digest('hex'),
      shimHash: await helper('codex-stdio-shim'),
      helperHash: await helper('codex-win-socket'),
      stopHash: await helper('codex-console-stop'),
    }) + '\n',
  );
}
