# MCP setup integration

This module adds client tabs and owner-operated setup buttons. The UI never displays or edits client configuration contents.
Development and tests use temporary files. They do not change installed clients.

## Dependency

Add the exact runtime dependency `@decimalturn/toml-patch` version `3.3.2` and update
the lockfile. `desktop/core/mcp-setup-editors.ts` imports its `parse` and `patch`
exports. The package is MIT licensed and has no runtime dependencies. JSONC uses
the existing `jsonc-parser` dependency.

## Electron main

Import `createMcpSetupHandler` from `./mcp-setup-ipc.js`. The handler consumes core-generated instructions through `service.clientInstructions`. Create the handler once per application
service inside `setupIpc`, outside the per-invocation callback:

```ts
const mcpSetup = createMcpSetupHandler({
  instructions: (client) => service!.clientInstructions(client),
  dialog,
  window: () => window,
  stateDirectory: app.getPath('userData'),
  openPath: (filename) => shell.openPath(filename),
});
```

Inside `interconnect:call`, after the existing exact sender/main-frame validation
and running-service check, before the ordinary method allowlist:

```ts
const setupResult = await mcpSetup(method, raw, String(event.sender.id));
if (setupResult.handled) return setupResult.result;
```

Do not expose these operations through `NodeService.userCall`, MCP tools, HTTP,
or remote peers. No changes to the preload bridge, existing contracts or service
are required. The handler's own input schemas are strict. Plans belong to the
validated UI sender, expire after ten minutes, and contain only generated edits;
the renderer cannot submit arbitrary file contents for writing.

## Renderer

Import `McpSetup` from `./McpSetup.js` and `McpSetupClient` from
`../shared/mcp-setup.js`. Type the existing `client` state as `McpSetupClient`.
Replace the current MCP page subtree (including the client select) with:

```tsx
<McpSetup client={client} onClientChange={setClient} invoke={call} />
```

Remove the old `instructions` fetching effect/state if no longer used elsewhere. Keep Applications-to-MCP navigation. `call` must retain a stable identity, as it currently does through
`useCallback`.

For localization, pass `messages` with translated values corresponding to the
keys of `mcpSetupEnglish` in `desktop/renderer/mcp-setup-messages.ts`. Missing keys
fall back to English. Add these keys to the shared translation catalog during
integration. Remove or rewrite existing text claiming that the app never changes
client settings. Project rules and public setup documentation must describe
a user-operated setup dialog and Apply instead of manual-only configuration.

## Behavior and scope

- Each client has a separate tab, button, dialog component, descriptions and
  generated changes. The common dialog shell shares path, preview and Apply
  behavior. The file list is rendered independently per file.
- Current integrations each modify one configuration file. OpenCode v1 adds two
  entries in that file: MCP and the bundled plugin. Additional file roles require
  explicit editor/target-schema support; arbitrary extra paths are rejected.
- Opening prepares changes internally without writing. Editing the path or choosing
  another file automatically checks it again; the dialog contains only Apply and
  Cancel. No configuration text, technical diff, manual setup accordion, editor or
  replacement checkbox is shown. Apply is the user's explicit confirmation.
- If required settings already exist, extra user options are preserved and the
  configuration file is left byte-for-byte unchanged. Applying that selection can
  remember its path without touching its contents.
- Successful Apply stores only the selected path under the corresponding client
  in `mcp-setup-paths.json` inside `stateDirectory`. No credentials, configuration
  contents or technical plan are persisted there. A failed operation never changes
  the remembered path. A path-saving failure is reported separately after success.
- Creating the main handler checks all four setup clients once, read-only, at startup.
  The visible tab checks again on mount and after Apply. There is no polling,
  automatic repair or configuration write on startup. The status is Settings are
  present, Not configured, Settings need updating or Could not check settings.
- The open-file icon calls `mcpSetupOpen` with a client identifier only. Main
  resolves that client's saved path (or known default) and uses the supplied
  `openPath`, which must delegate to `shell.openPath`. It accepts no arbitrary
  caller-provided destination. A missing file cannot be opened.
- The native picker requests `openFile` and `showHiddenFiles`. The latter is
  supported by Electron on macOS and Windows. Paths remain manually editable.
- Known paths are suggestions, not proof of the active client profile. No broad
  filesystem search, client launches, configuration CLI commands or polling run.
- An existing incompatible NCF entry is updated only after Apply. Other servers and
  plugins survive. Comments and unrelated formatting survive JSONC/TOML edits;
  replacing the managed entry can remove its custom options/comments.
- Prepared operations expose no configuration contents to the renderer. Parser
  errors omit source excerpts. Client credentials stay in the core process.
- Apply rechecks contents, identity, permissions and path resolution, rejects
  stale node connection settings, writes a private backup and replaces the file
  through a temporary file. New files and backups use mode 0600. Existing file
  mode is preserved. Symlinked or hard-linked files must be selected by a regular
  target path instead. Parent-directory retargeting invalidates a plan.
- A completed Apply result is cached under the same plan ID for the remaining
  plan lifetime. Uncertain IPC retries reuse that ID. Disk failure reports exact
  per-file status and backup location; recovery must not overwrite newer external
  changes. There is no OS-wide transaction with concurrently writing clients.
- OpenCode v2 markers are rejected. An empty configuration does not reveal a
  version: the dialog explicitly identifies v1 and does not claim v2 support.
- Saving does not prove that a client reloaded its configuration or connected.
  The UI gives the appropriate reconnect/restart instruction without launching it.

## Checks

```sh
node --import tsx --test test-desktop/mcp-setup.test.ts test-desktop/mcp-setup-model.test.ts
npm run typecheck
node --import tsx scripts/test-mcp-setup-ui.mjs
```

The standalone UI check runs Vite and a fresh headless Chrome profile with an
isolated service and temporary configuration directory. It does not open the hub,
bind an agent, read real configuration files or drive installed client settings.
Set `NCF_UI_CHROMIUM_CHANNEL` if a different installed Playwright browser channel
is required. The native picker is mocked in this component check and validated
at the IPC boundary in the unit suite; actual native picker display still needs
the integrated Electron check on each target OS.

After integration, run the full project checks and update the existing UI test:
MCP client selection is now by tab. Configuration snippets and their copy controls are removed; assert status and the owner-operated setup flow instead.
The standalone component check does not replace packaged-app or Windows testing.

AionUi reuses the file flow for Cursor Agent and the actual selected Cursor MCP
file. Its owner authorization has a separate client-specific dialog. It does
not imply that MCP was installed or registered. Before Apply, the UI explains
replacement of an existing NCF entry and the global effect outside AionUi.
Other AionUi backends without verified setup paths/APIs are not advertised.
