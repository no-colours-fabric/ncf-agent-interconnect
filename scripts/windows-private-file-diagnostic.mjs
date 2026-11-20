import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, realpath, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OpenCodeV2SetupService } from '../build/core/mcp-setup.js';
import { openCodeV2PrivateFiles } from '../build/core/opencode-v2-auth.js';

const source = await readFile(
  new URL('../desktop/core/opencode-v2-auth.ts', import.meta.url),
  'utf8',
);
const installedOperation = /const windowsAcl = String\.raw`([^]*?)`;/.exec(source)?.[1];
if (!installedOperation) throw new Error('The fixed Windows operation is unavailable');
const powershell = path.join(
  process.env.SystemRoot,
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);
function native(code, filename) {
  return spawnSync(
    powershell,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(code, 'utf16le').toString('base64'),
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
      maxBuffer: 65536,
      env: {
        ...process.env,
        NCF_PRIVATE_PATH: filename,
        NCF_PRIVATE_PROTECT: '1',
        NCF_PRIVATE_DIRECTORY: '1',
      },
    },
  );
}
const ownerOperation = String.raw`
$ErrorActionPreference='Stop'
$item=Get-Item -LiteralPath $env:NCF_PRIVATE_PATH
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$ownerSections=[Security.AccessControl.AccessControlSections]::Owner
$owner=$item.GetAccessControl($ownerSections).GetOwner([Security.Principal.SecurityIdentifier])
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
[Console]::Out.Write((@{
  currentOwner=($owner.Value -eq $sid.Value)
  administratorsOwner=($owner.Value -eq 'S-1-5-32-544')
  administrator=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} | ConvertTo-Json -Compress))
`;
for (const [label, parent] of [
  ['default', os.tmpdir()],
  ['runner', process.env.RUNNER_TEMP],
]) {
  if (!parent) continue;
  const temp = await mkdtemp(path.join(parent, 'ncf-private-'));
  try {
    const dir = path.join(temp, 'acl-sample');
    await mkdir(dir, { mode: 0o700 });
    const owner = native(ownerOperation, dir);
    const raw = native(installedOperation, dir);
    const stderr = raw.stderr ?? '';
    const category =
      [
        'owner',
        'inheritance',
        'rules',
        'principal',
        'rights',
        'propagation',
        'children',
        'reparse',
        'type',
      ].find(
        (key) => stderr.includes(`throw '${key}'`) || stderr.trimStart().startsWith(key + '\r\n'),
      ) ?? (stderr.includes('CouldNotAutoloadMatchingModule') ? 'module-load' : 'unclassified');
    const state = path.join(temp, 'node');
    await mkdir(state, { mode: 0o700 });
    const standard = openCodeV2PrivateFiles(path.join(state, 'Integrations', 'opencode-v2'));
    const steps = [];
    const checked = (operation) => async (filename, isDirectory) => {
      const started = Date.now();
      try {
        await standard[operation](filename, isDirectory);
        steps.push({ operation, isDirectory, ok: true, ms: Date.now() - started });
      } catch (error) {
        steps.push({
          operation,
          isDirectory,
          ok: false,
          category: /^V2_[A-Z_]+$/.test(error.message) ? error.message : 'unknown',
          ms: Date.now() - started,
        });
        throw error;
      }
    };
    const setup = new OpenCodeV2SetupService({
      stateDirectory: state,
      home: temp,
      env: {},
      instructions: () => {
        throw new Error('Unexpected v1 setup');
      },
      security: {
        available: standard.available,
        protect: checked('protect'),
        verify: checked('verify'),
      },
      checkpoint: (phase) => steps.push({ phase }),
    });
    const profilePath = path.join(temp, 'target');
    const target = {
      major: 2,
      installationId: null,
      installationPath: null,
      profilePath,
      configurationPath: path.join(profilePath, 'opencode.json'),
    };
    let apply;
    try {
      const preview = await setup.v2Preview('runner-diagnostic', target);
      const result = await setup.v2Apply('runner-diagnostic', preview.planId, target, false);
      apply = { status: result.status, files: result.files.map((file) => file.status) };
    } catch {
      apply = { status: 'failed-before-result' };
    }
    console.log(
      JSON.stringify({
        label,
        canonicalRoot: (await realpath(temp)) === temp,
        owner: owner.status === 0 ? JSON.parse(owner.stdout) : { probeFailed: true },
        native: {
          code: raw.status,
          marker: raw.stdout === 'NCF_PRIVATE_OK',
          stderr: stderr.length > 0,
          category,
          error: raw.error?.code,
        },
        apply,
        steps,
      }),
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
