import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import type { OpenCodeV2SetupTarget } from '../shared/mcp-setup.js';
import { parseOpenCodeV2Provision, type OpenCodeV2Provision } from './opencode-v2-protocol.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
// Process-local invalidation only; credentials and delivery state never enter this signal.
const publications = new EventEmitter();
const filename = z.string().min(1).max(8192).refine(path.isAbsolute);
export const openCodeV2TargetSchema = z
  .object({
    major: z.literal(2),
    installationId: z.string().min(1).max(512).nullable(),
    installationPath: filename.nullable(),
    profilePath: filename,
    configurationPath: filename,
  })
  .strict();
const rowSchema = z
  .object({
    targetId: z.uuid(),
    generation: z.uuid(),
    selected: openCodeV2TargetSchema,
    credentialVerifier: z.string().regex(/^[a-f0-9]{64}$/),
    configurationHash: z.string().regex(/^[a-f0-9]{64}$/),
    descriptorHash: z.string().regex(/^[a-f0-9]{64}$/),
    assetHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const registrySchema = z
  .object({ version: z.literal(1), targets: z.array(rowSchema).max(128) })
  .strict();
type Registry = z.infer<typeof registrySchema>;
export type OpenCodeV2AuthRow = z.infer<typeof rowSchema>;
export interface OpenCodeV2PrivateFiles {
  protect(filename: string, directory: boolean): Promise<void>;
  verify(filename: string, directory: boolean): Promise<void>;
}

// Fixed OS operation. The only input is an own, validated path passed as data.
// DirectorySecurity / SetAccessRuleProtection / Get-Acl are Microsoft Windows APIs.
const windowsAcl = String.raw`
$ErrorActionPreference='Stop'
$p=$env:NCF_PRIVATE_PATH
$item=Get-Item -LiteralPath $p -Force
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse' }
$directory=$env:NCF_PRIVATE_DIRECTORY -eq '1'
if ($item.PSIsContainer -ne $directory) { throw 'type' }
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$principals=@($sid.Value,'S-1-5-18','S-1-5-32-544') | Select-Object -Unique
if ($env:NCF_PRIVATE_PROTECT -eq '1') {
  if ($directory) { $acl=New-Object Security.AccessControl.DirectorySecurity }
  else { $acl=New-Object Security.AccessControl.FileSecurity }
  $acl.SetOwner($sid)
  $acl.SetAccessRuleProtection($true,$false)
  foreach ($principal in $principals) {
    $who=New-Object Security.Principal.SecurityIdentifier($principal)
    if ($directory) {
      $rule=New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    } else {
      $rule=New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','Allow')
    }
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $p -AclObject $acl
}
$actual=Get-Acl -LiteralPath $p
if ($actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'owner' }
if (!$actual.AreAccessRulesProtected) { throw 'inheritance' }
$rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
if ($rules.Count -ne $principals.Count) { throw 'rules' }
foreach ($principal in $principals) {
  $matching=@($rules | Where-Object { $_.IdentityReference.Value -eq $principal })
  if ($matching.Count -ne 1) { throw 'principal' }
  $rule=$matching[0]
  if ($rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl') { throw 'rights' }
  if ($rule.PropagationFlags -ne 'None') { throw 'propagation' }
  if ($directory -and $rule.InheritanceFlags -ne 'ContainerInherit, ObjectInherit') { throw 'children' }
  if (!$directory -and $rule.InheritanceFlags -ne 'None') { throw 'children' }
}
[Console]::Out.Write('NCF_PRIVATE_OK')
`;
export function openCodeV2PrivateFiles(root: string): OpenCodeV2PrivateFiles {
  const assertOwn = (file: string) => {
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('V2_PRIVATE_SCOPE');
  };
  const inspect = async (file: string, directory: boolean, protect: boolean) => {
    assertOwn(file);
    const info = await lstat(file);
    if (
      info.isSymbolicLink() ||
      info.isDirectory() !== directory ||
      (!directory && (!info.isFile() || info.nlink !== 1))
    )
      throw new Error('V2_PRIVATE_FILE');
    if (process.platform !== 'win32') {
      if (info.uid !== process.getuid?.() || (info.mode & 0o777) !== (directory ? 0o700 : 0o600))
        throw new Error('V2_PRIVATE_PERMISSIONS');
      return;
    }
    const executable = path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    );
    try {
      const result = await promisify(execFile)(
        executable,
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-EncodedCommand',
          Buffer.from(windowsAcl, 'utf16le').toString('base64'),
        ],
        {
          windowsHide: true,
          timeout: 5000,
          maxBuffer: 4096,
          env: {
            ...process.env,
            NCF_PRIVATE_PATH: file,
            NCF_PRIVATE_DIRECTORY: directory ? '1' : '0',
            NCF_PRIVATE_PROTECT: protect ? '1' : '0',
          },
        },
      );
      if (result.stdout !== 'NCF_PRIVATE_OK' || result.stderr) throw new Error();
    } catch {
      throw new Error('V2_PRIVATE_ACL_UNAVAILABLE');
    }
  };
  return {
    protect: (file, directory) => inspect(file, directory, true),
    verify: (file, directory) => inspect(file, directory, false),
  };
}
export interface OpenCodeV2AuthDraft {
  readonly target: OpenCodeV2SetupTarget;
  readonly provision: OpenCodeV2Provision;
  readonly generationDirectory: string;
  readonly registryStamp: string;
  readonly existing?: OpenCodeV2AuthRow;
}
export class OpenCodeV2Auth {
  readonly root: string;
  private readonly registryFile: string;
  private readonly security: OpenCodeV2PrivateFiles;
  private publishing = false;
  constructor(
    directory: string,
    private readonly options: {
      security?: OpenCodeV2PrivateFiles;
      configurationHash: (filename: string) => Promise<string>;
      changed?: (targetId: string) => void;
      checkpoint?: (phase: 'protected' | 'assets' | 'before-activate' | 'activated') => void;
    },
  ) {
    this.root = path.join(directory, 'Integrations', 'opencode-v2');
    this.registryFile = path.join(this.root, 'targets.json');
    this.security = options.security ?? openCodeV2PrivateFiles(this.root);
  }
  observe(listener: (targetId: string) => void): () => void {
    publications.on(this.root, listener);
    return () => {
      publications.off(this.root, listener);
    };
  }
  private async checkedDirectory(directory: string): Promise<void> {
    const parent = path.dirname(directory);
    if (directory !== this.root) {
      if (!directory.startsWith(this.root + path.sep)) throw new Error('V2_PRIVATE_SCOPE');
      await this.checkedDirectory(parent);
    }
    let created = false;
    try {
      if (directory === this.root)
        created = (await mkdir(directory, { mode: 0o700, recursive: true })) !== undefined;
      else {
        await mkdir(directory, { mode: 0o700 });
        created = true;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (created) await this.security.protect(directory, true);
    await this.security.verify(directory, true);
    if (
      (await realpath(directory)) !==
      path.join(await realpath(this.root), path.relative(this.root, directory))
    )
      throw new Error('V2_PRIVATE_SCOPE');
  }
  private async readPrivate(file: string): Promise<string> {
    await this.security.verify(path.dirname(file), true);
    await this.security.verify(file, false);
    const handle = await open(
      file,
      constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW),
    );
    try {
      const info = await handle.stat();
      if (info.size > 1024 * 1024 || !info.isFile() || info.nlink !== 1)
        throw new Error('V2_PRIVATE_FILE');
      const bytes = await handle.readFile();
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } finally {
      await handle.close();
    }
  }
  private async registry(): Promise<{ value: Registry; stamp: string }> {
    let raw: string;
    try {
      raw = await this.readPrivate(this.registryFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { value: { version: 1, targets: [] }, stamp: 'missing' };
      throw new Error('V2_TARGET_REGISTRY_UNAVAILABLE');
    }
    try {
      const value = registrySchema.parse(JSON.parse(raw));
      if (
        new Set(value.targets.map((row) => row.targetId)).size !== value.targets.length ||
        new Set(value.targets.map((row) => row.selected.configurationPath)).size !==
          value.targets.length
      )
        throw new Error();
      return { value, stamp: hash(raw) };
    } catch {
      throw new Error('V2_TARGET_REGISTRY_UNAVAILABLE');
    }
  }
  private async writePrivate(file: string, data: string): Promise<void> {
    const handle = await open(file, 'wx', 0o600);
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await this.security.protect(file, false);
    await this.security.verify(file, false);
  }
  generation(row: Pick<OpenCodeV2AuthRow, 'targetId' | 'generation'>): string {
    return path.join(this.root, z.uuid().parse(row.targetId), z.uuid().parse(row.generation));
  }
  async current(target: OpenCodeV2SetupTarget): Promise<OpenCodeV2AuthRow | undefined> {
    const parsed = openCodeV2TargetSchema.parse(target);
    const { value } = await this.registry();
    const row = value.targets.find(
      (row) => row.selected.configurationPath === parsed.configurationPath,
    );
    if (!row) return;
    if (JSON.stringify(row.selected) !== JSON.stringify(parsed))
      throw new Error('V2_TARGET_SELECTION_CHANGED');
    await this.verifyRow(row);
    return row;
  }
  private async verifyRow(
    row: OpenCodeV2AuthRow,
    requireConfiguration = true,
  ): Promise<OpenCodeV2Provision> {
    const folder = this.generation(row);
    const raw = await this.readPrivate(path.join(folder, 'ncf-target.json'));
    const provision = parseOpenCodeV2Provision(JSON.parse(raw));
    if (
      provision.targetId !== row.targetId ||
      provision.generation !== row.generation ||
      hash(raw) !== row.descriptorHash ||
      hash(provision.credential) !== row.credentialVerifier
    )
      throw new Error('V2_TARGET_DESCRIPTOR_MISMATCH');
    const asset = await this.readPrivate(path.join(folder, 'index.js'));
    if (
      hash(asset) !== row.assetHash ||
      (requireConfiguration &&
        (await this.options.configurationHash(row.selected.configurationPath)) !==
          row.configurationHash)
    )
      throw new Error('V2_TARGET_CONFIGURATION_MISMATCH');
    return provision;
  }
  async authenticate(
    targetId: string,
    generation: string,
    credential: string,
  ): Promise<OpenCodeV2AuthRow> {
    if (!/^[a-f0-9]{64}$/.test(credential)) throw new Error('V2_TARGET_UNAUTHORIZED');
    const { value } = await this.registry();
    const row = value.targets.find(
      (row) => row.targetId === targetId && row.generation === generation,
    );
    if (
      !row ||
      !timingSafeEqual(
        Buffer.from(row.credentialVerifier, 'hex'),
        Buffer.from(hash(credential), 'hex'),
      )
    )
      throw new Error('V2_TARGET_UNAUTHORIZED');
    await this.verifyRow(row);
    return row;
  }
  /** Private in-memory preview. No descriptor/registry/config write occurs here. */
  async prepare(
    target: OpenCodeV2SetupTarget,
    nodeId: string,
    nodeUrl: string,
    forceNewGeneration = false,
  ): Promise<OpenCodeV2AuthDraft> {
    const selected = openCodeV2TargetSchema.parse(target),
      registry = await this.registry();
    const row = registry.value.targets.find(
      (row) => row.selected.configurationPath === selected.configurationPath,
    );
    if (row) {
      if (JSON.stringify(row.selected) !== JSON.stringify(selected))
        throw new Error('V2_TARGET_SELECTION_CHANGED');
      const provision = await this.verifyRow(row, false);
      const coherent = await this.options.configurationHash(row.selected.configurationPath).then(
        (value) => value === row.configurationHash,
        () => false,
      );
      if (
        !forceNewGeneration &&
        coherent &&
        provision.nodeId === nodeId &&
        provision.nodeUrl === nodeUrl
      )
        return {
          target: selected,
          provision,
          generationDirectory: this.generation(row),
          registryStamp: registry.stamp,
          existing: row,
        };
    }
    const provision = parseOpenCodeV2Provision({
      protocol: 2,
      nodeId,
      nodeUrl,
      targetId: row?.targetId ?? randomUUID(),
      generation: randomUUID(),
      credential: randomBytes(32).toString('hex'),
    });
    return {
      target: selected,
      provision,
      generationDirectory: this.generation(provision),
      registryStamp: registry.stamp,
    };
  }
  /** Called only inside the owner's guarded Apply transaction. */
  async stage(draft: OpenCodeV2AuthDraft, asset: string): Promise<void> {
    if (draft.existing) return;
    await this.checkedDirectory(draft.generationDirectory);
    this.options.checkpoint?.('protected');
    await this.writePrivate(path.join(draft.generationDirectory, 'index.js'), asset);
    await this.writePrivate(
      path.join(draft.generationDirectory, 'package.json'),
      JSON.stringify({ type: 'module', main: 'index.js' }),
    );
    await this.writePrivate(
      path.join(draft.generationDirectory, 'ncf-target.json'),
      JSON.stringify(draft.provision),
    );
    this.options.checkpoint?.('assets');
  }
  /** Atomic verifier activation is the LAST durable transaction step. */
  async activate(
    draft: OpenCodeV2AuthDraft,
    asset: string,
    configurationHash: string,
  ): Promise<void> {
    if (this.publishing) throw new Error('V2_TARGET_UPDATE_BUSY');
    this.publishing = true;
    let temporary: string | undefined;
    try {
      const registry = await this.registry();
      if (registry.stamp !== draft.registryStamp) throw new Error('V2_TARGET_REGISTRY_CHANGED');
      if (draft.existing) {
        await this.verifyRow(draft.existing);
        return;
      }
      const descriptor = await this.readPrivate(
        path.join(draft.generationDirectory, 'ncf-target.json'),
      );
      if (
        descriptor !== JSON.stringify(draft.provision) ||
        (await this.readPrivate(path.join(draft.generationDirectory, 'index.js'))) !== asset ||
        (await this.options.configurationHash(draft.target.configurationPath)) !== configurationHash
      )
        throw new Error('V2_TARGET_PUBLICATION_CHANGED');
      const row: OpenCodeV2AuthRow = {
        targetId: draft.provision.targetId,
        generation: draft.provision.generation,
        selected: draft.target,
        credentialVerifier: hash(draft.provision.credential),
        configurationHash,
        descriptorHash: hash(descriptor),
        assetHash: hash(asset),
      };
      const next = registrySchema.parse({
        version: 1,
        targets: [
          ...registry.value.targets.filter((row) => row.targetId !== draft.provision.targetId),
          row,
        ],
      });
      temporary = path.join(this.root, '.targets-' + randomUUID() + '.tmp');
      await this.writePrivate(temporary, JSON.stringify(next));
      this.options.checkpoint?.('before-activate');
      if (
        (await this.registry()).stamp !== draft.registryStamp ||
        (await this.options.configurationHash(draft.target.configurationPath)) !== configurationHash
      )
        throw new Error('V2_TARGET_PUBLICATION_CHANGED');
      await rename(temporary, this.registryFile);
      temporary = undefined;
      // Publication committed. Notify every observer; none may turn success into rollback.
      for (const listener of publications.listeners(this.root)) {
        try {
          listener(row.targetId);
        } catch {
          /* Isolate an unrelated observer. */
        }
      }
      try {
        this.options.changed?.(row.targetId);
      } catch {
        /* Already committed. */
      }
      try {
        this.options.checkpoint?.('activated');
      } catch {
        /* Already committed. */
      }
    } finally {
      this.publishing = false;
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
}
