import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicJson } from './settings.js';
import type { McpSetupClient } from '../shared/mcp-setup.js';

const filenameSchema = z.string().min(1).max(8192).refine(path.isAbsolute);
const schema = z
  .object({
    version: z.literal(1),
    paths: z
      .object({
        cursor: filenameSchema.optional(),
        aionui: filenameSchema.optional(),
        opencode: filenameSchema.optional(),
        codex: filenameSchema.optional(),
        claude: filenameSchema.optional(),
      })
      .strict(),
  })
  .strict();

/** Persists paths only. Client configuration and credentials never enter this file. */
export class McpSetupPaths {
  private readonly filename: string;
  constructor(directory: string) {
    this.filename = path.join(directory, 'mcp-setup-paths.json');
  }
  private async read(): Promise<z.infer<typeof schema>> {
    try {
      const data = await readFile(this.filename);
      if (data.length > 32768) throw new Error();
      return schema.parse(JSON.parse(data.toString('utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, paths: {} };
      throw new Error('The saved configuration paths could not be read');
    }
  }
  async get(client: McpSetupClient): Promise<string | undefined> {
    return (await this.read()).paths[client];
  }
  async remember(client: McpSetupClient, filename: string): Promise<void> {
    const saved = await this.read();
    if (saved.paths[client] === filename) return;
    saved.paths[client] = filenameSchema.parse(filename);
    await atomicJson(this.filename, saved);
  }
}
