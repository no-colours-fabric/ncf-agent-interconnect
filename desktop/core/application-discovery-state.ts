import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicJson } from './settings.js';
import { mcpSetupClients, type McpSetupClient } from '../shared/mcp-setup.js';
import type { ApplicationInstallation } from '../shared/application-discovery.js';

const schema = z
  .object({
    version: z.literal(1),
    offered: z.partialRecord(z.enum(mcpSetupClients), z.iso.datetime()),
  })
  .strict();
type State = z.infer<typeof schema>;

/** This file belongs to NCF. It contains neither client settings nor installation paths. */
export class ApplicationDiscoveryState {
  private readonly filename;
  private state?: State;
  private loading?: Promise<void>;
  private writing: Promise<unknown> = Promise.resolve();
  error = false;

  constructor(
    directory: string,
    private readonly now: () => number = Date.now,
  ) {
    this.filename = path.join(directory, 'application-discovery.json');
  }

  private async load(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        this.state = await this.read();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          this.state = { version: 1, offered: {} };
        else this.error = true;
      }
    })();
    return this.loading;
  }

  private async read(): Promise<State> {
    try {
      const info = await lstat(this.filename);
      if (!info.isFile() || info.size > 32768) throw new Error('Invalid discovery state');
      const file = await open(this.filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const data = Buffer.alloc(32769);
        const { bytesRead } = await file.read(data, 0, data.length, 0);
        if (bytesRead > 32768) throw new Error('Invalid discovery state');
        return schema.parse(JSON.parse(data.subarray(0, bytesRead).toString('utf8')));
      } finally {
        await file.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, offered: {} };
      throw error;
    }
  }

  async offers(applications: ApplicationInstallation[]): Promise<McpSetupClient[]> {
    await this.load();
    if (this.error || !this.state) return [];
    return applications
      .filter((app) => app.status === 'detected' && !this.state!.offered[app.client])
      .map((app) => app.client);
  }

  /** Called only after the owner renderer reports that these offers became visible. */
  async markOffered(clients: McpSetupClient[]): Promise<boolean> {
    const work = this.writing.then(async () => {
      await this.load();
      if (this.error || !this.state) return false;
      let next: State;
      try {
        const disk = await this.read();
        next = schema.parse({ version: 1, offered: { ...disk.offered, ...this.state.offered } });
      } catch {
        this.error = true;
        return false;
      }
      let changed = false;
      for (const client of clients)
        if (!next.offered[client]) {
          next.offered[client] = new Date(this.now()).toISOString();
          changed = true;
        }
      if (!changed) return true;
      try {
        await atomicJson(this.filename, next);
        this.state = next;
        return true;
      } catch {
        this.error = true;
        return false;
      }
    });
    this.writing = work.catch(() => undefined);
    return work;
  }
}
