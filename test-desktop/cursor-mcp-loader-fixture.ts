import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface CursorStdioEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}
type Environment = Record<string, string>;

/** Test loader contract; the ambient ACP environment is never passed directly to stdio. */
export async function cursorMcpFixtureLoader() {
  const filename = process.env.NCF_CURSOR_CLI_BUNDLE;
  if (!filename) {
    const inheritedKeys = Object.keys(getDefaultEnvironment());
    return {
      provenance: 'Cursor documented interpolation and MCP SDK whitelist contract',
      load(entry: CursorStdioEntry, ambient: Environment): CursorStdioEntry {
        const inherited = Object.fromEntries(
          inheritedKeys
            .filter((key) => ambient[key] !== undefined)
            .map((key) => [key, ambient[key]]),
        );
        const explicit = Object.fromEntries(
          Object.entries(entry.env).map(([key, value]) => [
            key,
            value.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (reference, name) =>
              ambient[name] === undefined ? reference : ambient[name],
            ),
          ]),
        );
        return { ...entry, env: { ...inherited, ...explicit } };
      },
    };
  }

  // Optional vendor evidence uses exact pure functions, never its launcher or CLI entry point.
  const bytes = await readFile(filename);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const reviewed = new Map([
    [
      '943765eeedb4fe5d4ab6d95fc839c3eaf0c070e734577409badb9dea5b0ed293',
      { defaultsStart: 'const Ja=[', defaultsEnd: 'class Pa{', defaults: 'Ta', process: 'ka' },
    ],
    [
      'd6794834b28f88f328e4090a2c3480bc8fa7c43afe6f6d96a937148a3fc45735',
      { defaultsStart: 'const To=[', defaultsEnd: 'class Ro{', defaults: 'Po', process: 'Jo' },
    ],
  ]);
  const symbols = reviewed.get(hash);
  if (!symbols) throw new Error('The Cursor fixture bundle requires a source review.');
  const source = bytes.toString('utf8');
  const moduleStart = source.indexOf('"../mcp-agent-exec/dist/index.js"(t,e,r)');
  const moduleEnd = source.indexOf('},"../', moduleStart + 50);
  if (moduleStart < 0 || moduleEnd < 0) throw new Error('The Cursor MCP module was not found.');
  const module = source.slice(moduleStart, moduleEnd);
  const resolverStart = module.indexOf('const ut=');
  const resolverEnd = module.indexOf('function ft(', resolverStart);
  const defaultsStart = module.indexOf(symbols.defaultsStart);
  const defaultsEnd = module.indexOf(symbols.defaultsEnd, defaultsStart);
  if ([resolverStart, resolverEnd, defaultsStart, defaultsEnd].some((offset) => offset < 0))
    throw new Error('The reviewed Cursor pure functions were not found.');
  const functions =
    module.slice(resolverStart, resolverEnd) + module.slice(defaultsStart, defaultsEnd);
  return {
    provenance: 'Installed Cursor 2026.10.22-27dcf5f pure resolver and whitelist',
    load(entry: CursorStdioEntry, ambient: Environment): CursorStdioEntry {
      const result: string = vm.runInNewContext(
        functions +
          '; const resolved=mt(entry, name=>ambient[name]);' +
          `JSON.stringify({...resolved,env:{...${symbols.defaults}(),...resolved.env}})`,
        { entry, ambient, [symbols.process]: { env: ambient }, process: { env: ambient } },
        { timeout: 1000 },
      );
      return JSON.parse(result);
    },
  };
}
