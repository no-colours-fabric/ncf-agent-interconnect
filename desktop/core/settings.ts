import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { networkInterfaces, hostname } from 'node:os';
import path from 'node:path';
import { isIP } from 'node:net';
import { z } from 'zod';
import type { Peer, Settings } from '../shared/contracts.js';

export const adapterSchema = z
  .object({
    id: z.uuid(),
    label: z.string().min(1).max(120),
    kind: z.enum([
      'manual',
      'opencode-http',
      'codex-desktop',
      'cursor-hook',
      'aionui',
      'claude-code',
    ]),
    aionConnectionId: z.uuid().optional(),
    baseUrl: z.url().optional(),
    sessionId: z.string().max(200).optional(),
    username: z.string().max(200).optional(),
    password: z.string().max(2000).optional(),
    threadId: z.uuid().optional(),
    socket: z.string().min(1).max(2000).optional(),
    workspace: z.string().max(4000).optional(),
    instanceId: z.uuid().optional(),
    hostPid: z.number().int().positive().optional(),
    released: z.boolean().optional(),
  })
  .strict()
  .superRefine((profile, ctx) => {
    if (profile.kind === 'aionui' && (!profile.aionConnectionId || !profile.sessionId))
      ctx.addIssue({
        code: 'custom',
        message: 'The AionUi integration did not provide the current chat',
      });
    if (profile.kind === 'claude-code' && !z.uuid().safeParse(profile.sessionId).success)
      ctx.addIssue({
        code: 'custom',
        message: 'The Claude Code integration did not provide the current chat',
        path: ['sessionId'],
      });
    if (profile.kind === 'codex-desktop' && !profile.threadId)
      ctx.addIssue({
        code: 'custom',
        message: 'The Codex integration did not provide the current chat',
        path: ['threadId'],
      });
    if (profile.kind === 'cursor-hook' && !profile.sessionId)
      ctx.addIssue({
        code: 'custom',
        message: 'The Cursor integration did not provide the current chat',
        path: ['sessionId'],
      });
    if (profile.kind === 'opencode-http' && (!profile.baseUrl || !profile.sessionId))
      ctx.addIssue({
        code: 'custom',
        message: 'The OpenCode integration did not provide the chat context',
      });
  });
const peerSchema = z
  .object({
    id: z.uuid(),
    label: z.string().max(120),
    address: z.string(),
    secret: z.string().regex(/^[a-f0-9]{64}$/),
    certificate: z.string().max(20000),
  })
  .strict();
export const settingsSchema = z
  .object({
    version: z.literal(1),
    nodeId: z.uuid(),
    nodeLabel: z.string().min(1).max(120),
    localToken: z.string().regex(/^[a-f0-9]{64}$/),
    mcpPort: z.number().int().min(0).max(65535),
    peerPort: z.number().int().min(0).max(65535),
    listenHost: z.string().min(1).max(255),
    exportRoots: z.array(z.string()).min(1),
    peers: z.array(peerSchema),
    adapters: z.array(adapterSchema).min(1),
  })
  .strict();
export async function atomicJson(
  filename: string,
  data: unknown,
  beforeWrite?: () => void,
): Promise<void> {
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = filename + '.' + randomUUID() + '.tmp';
  beforeWrite?.();
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, filename);
}
export function localAddresses(): string[] {
  return [
    ...new Set(
      Object.values(networkInterfaces())
        .flatMap((v) => v ?? [])
        .filter((v) => v.family === 'IPv4')
        .map((v) => v.address),
    ),
  ];
}
export function normalizePeerAddress(value: string): string {
  const raw = value.trim();
  const implicit = isIP(raw) === 6 ? `[${raw}]:7336` : !raw.includes(':') ? raw + ':7336' : raw;
  const url = new URL(raw.includes('://') ? raw : 'wss://' + implicit);
  if (
    !['wss:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['/', '/peer'].includes(url.pathname)
  )
    throw new Error(
      'Enter IP:port or a wss://host:port URL. Credentials and URL parameters are not allowed.',
    );
  url.protocol = 'wss:';
  url.pathname = '/peer';
  return url.toString();
}
export class SettingsFile {
  value!: Settings;
  private saving: Promise<void> = Promise.resolve();
  constructor(public readonly directory: string) {}
  get filename(): string {
    return path.join(this.directory, 'settings.json');
  }
  async load(): Promise<Settings> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      this.value = settingsSchema.parse(JSON.parse(await readFile(this.filename, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const files = path.join(this.directory, 'Files');
      await mkdir(files, { recursive: true, mode: 0o700 });
      this.value = {
        version: 1,
        nodeId: randomUUID(),
        nodeLabel: hostname(),
        localToken: randomBytes(32).toString('hex'),
        mcpPort: 0,
        peerPort: 7336,
        listenHost: '127.0.0.1',
        exportRoots: [files],
        peers: [],
        adapters: [
          { id: randomUUID(), kind: 'manual', label: 'Standard MCP — receive through tools' },
        ],
      };
      await this.save();
    }
    return this.value;
  }
  async save(): Promise<void> {
    const operation = this.saving.then(async () => {
      settingsSchema.parse(this.value);
      await atomicJson(this.filename, this.value);
    });
    this.saving = operation.catch(() => {});
    await operation;
  }
  async savePeers(
    update: (current: readonly Peer[]) => Peer[],
    beforeWrite?: () => void,
  ): Promise<void> {
    const operation = this.saving.then(async () => {
      const candidate = settingsSchema.parse({
        ...this.value,
        peers: update(structuredClone(this.value.peers)),
      });
      await atomicJson(this.filename, candidate, beforeWrite);
      this.value.peers = candidate.peers;
    });
    this.saving = operation.catch(() => {});
    await operation;
  }
}
