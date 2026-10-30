# Development

Use Node.js 22.12 or later and npm. `npm ci` installs the exact versions in
`package-lock.json`; Electron supplies the runtime in binary packages.

```sh
npm run check
npm test
npm run build
npm run test:ui
```

`npm run format` applies the shared Prettier style. `npm run check` checks types
and formatting.

`npm run app` builds and opens a development app. For an isolated instance after
building, use `npx electron . --data-dir <an-empty-test-directory>`. Do not use a
live node data directory for fixtures.

## Test scopes

- `test-desktop` exercises real loopback MCP clients and two or three isolated
  TLS nodes, ownership, transfers, history, file verification and restart recovery.
- Adapter fixtures validate exact targets, complete message envelopes, busy/idle
  behavior and uncertain admission. They do not prove a live model client UI.
- `scripts/test-desktop-ui.mjs` opens the actual Electron app with temporary data.
  It tests the renderer, local and remote messages, files, receipt counters and
  continued exchange after closing the window.
- `scripts/verify-release.mjs` extracts the packaged app outside the checkout and
  runs its shipped runtime against isolated nodes and the bundled plugin.

For a packaged GUI check, set `INTERCONNECT_TEST_EXECUTABLE` to the built app
executable before running `npm run test:ui`.

## Source layout

| Path                   | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `desktop/core`         | Transport, MCP, persistence, files and adapters |
| `desktop/integrations` | Client-hosted integration plugin                |
| `desktop/main`         | Electron lifecycle and native boundaries        |
| `desktop/renderer`     | React and Material UI interface                 |
| `desktop/shared`       | Typed contracts and schemas                     |
| `scripts`              | Build, verification and release tooling         |
| `test-desktop`         | Isolated product tests                          |

Follow [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
