# Development

Use Node.js 22.12 or later and npm. `npm ci` installs the exact versions in
`package-lock.json`; Electron supplies the runtime in binary packages.

The build toolchain pins `electron-builder` to `27.0.0-alpha.14`. This prerelease
updates the legacy ASAR, download and Squirrel dependency chains that produced
deprecated-package warnings in version 26. Scoped overrides pin `minimatch` to
11.0.3 and ASAR's `glob` to 14.0.3 to address
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) and
[GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).
Review these overrides when updating the builder. Changes to this toolchain
require native package and packaged-UI verification on macOS and Windows.
The builder configuration sets `publish: null` because the application has no
automatic updater. Release assets are uploaded separately; the builder must not
infer an update feed from the repository URL.

```sh
npm run check
npm audit --audit-level=moderate
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
  Packaging fixtures check builder filters, file lists and ASAR unpack rules with
  the overridden dependencies.
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

## UI localization

The renderer supports switchable interface languages. English is the default
and the fallback when a key is missing. A selector at the bottom of the left
sidebar changes the language; the choice is stored in the Electron application
profile (renderer `localStorage`) and survives restarts.

Conventions:

- Add every user-visible string in `desktop/renderer/main.tsx` through the `t`
  helper, keyed by an entry in `desktop/renderer/i18n/messages.ts`.
- Provide every key in every dictionary under `desktop/renderer/i18n`.
  Supported locales: English, Russian, Chinese (Simplified), French, German,
  Italian, Spanish, Kazakh and Japanese. Add a new locale by creating its
  dictionary and registering it in `desktop/renderer/i18n/index.ts`.
- Never translate user text: agent names, nicknames, message bodies, file names,
  node IDs, addresses and UUIDs stay as-is.
- MCP instructions are served in English and are not localized.
- `desktop/renderer/i18n` is bundled only into the renderer; it must not import
  from `desktop/core`.

Locale coverage is checked by `test-desktop/i18n.test.ts` (fallback, dictionary
parity and interpolation). The language switch, persistence and restart behavior
are exercised by `scripts/test-desktop-ui-locale.mjs`.
