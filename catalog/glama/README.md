# Glama container configuration

This catalog-only launcher runs the unchanged production **NCF Agent Interconnect**
Electron application in its existing background mode. NCF abbreviates the brand
**No Colours Fabric**. It does not implement a headless replacement, another
mailbox or an independent MCP tool registry.

## Build specification

Use the fields in [build-spec.json](build-spec.json) in the Glama Dockerfile form:

- Base image: Debian trixie slim.
- Node: 24. Python: none.
- Build steps and CMD: copy the exact JSON arrays.
- Environment schema: the supplied empty object schema.
- Placeholder parameters: an empty object.
- Pinned commit: the final integrated commit containing these files. The
  repository file deliberately leaves this value null; do not use a moving
  branch or an earlier commit that lacks the launcher.

Glama installs \`mcp-proxy@6.9.0\` globally. The launcher verifies that package
identity/version and uses its documented \`startStdioServer\` HTTPStream API.
There is one outer \`mcp-proxy\` in CMD. Do not wrap it a second time.

The build uses the repository's npm lock, downloads its pinned official Electron
45.1.0 runtime once, and compiles the application. No release installer or full
test suite is built by this catalog recipe. Normal system libraries include
Debian's GTK/ALSA t64 packages, Xvfb, Xauthority and D-Bus.

## Runtime and isolation

The CMD uses setpriv to execute directly as a dedicated nonroot account, without
a user-switch supervisor that could forcibly terminate its child. It creates a private display and session bus,
HOME/XDG directories and application data for this deployment, with no host
profiles, client configuration, account credentials or paired peers. The
application's standard SettingsFile initializes ephemeral loopback ports on first start.
No real client Apply action or account login is performed.

Application data lives in the dedicated account's private `/home/ncf/.ncf-glama`
directory. A process restart reuses that state instead of silently creating a new
node or discarding history. Display/log/runtime directories are per invocation.
Container replacement requires retaining this directory through the platform's
storage mechanism; persistent Glama storage has not been verified by this recipe.
Never mount an owner's real home or client profile there.

The actual Electron application creates its own private \`Integrations/node.json\`.
The launcher reads that exact loopback URL and token in memory and opens an
authenticated HTTP MCP connection. The generic proxy mirrors the upstream
capabilities/tools into stdio. It does not copy tool definitions, call
\`agent_connect\`, send messages or run scheduled agent polling.

Protocol stdout belongs exclusively to MCP. Full Electron stdout/stderr and a
sanitized lifecycle record remain in the private diagnostics directory announced
on stderr. Tokens are not printed. Treat the directory as private application
state; do not upload it or preserve its generated credentials in public fixtures.

Each process owns one node and one upstream MCP connection. The outer proxy can
multiplex callers onto that connection; it does not preserve independent
per-caller identity. Use a separate deployment for each trusted principal.
This recipe does not establish automatic delivery for desktop adapters or
multi-user isolation inside one shared proxy.

The app uses its existing \`--background\` mode. Successful startup/initialize is
not renderer, GUI, desktop-client, model-reaction or native-platform acceptance.

## Sandbox requirement

Keep the production sandbox. The official Chromium helper must be root:root
4755, and the runtime must permit Chromium's normal sandbox mechanisms.
No \`--no-sandbox\`, \`--disable-setuid-sandbox\`, \`--disable-gpu\`, privileged
container, added capabilities or seccomp bypass is part of this recipe.

Missing system libraries and unsupported sandbox runtime policy are different
failures. A prior Docker environment did not launch sandboxed Electron; its
cause was not established. That is not proof of Glama compatibility or failure.
On a sandbox refusal, retain the direct stderr and report the exact platform
prerequisite. Do not substitute a fake MCP server or disable sandboxing to get a
green catalog test.

## Lifecycle and verification limits

EOF, proxy close, startup failure or a termination signal closes the proxy's
upstream connection and requests SIGTERM cleanup of this invocation's own
Electron child, then its display. The launcher waits for actual child exit.
There is no SIGKILL, timed force exit or process-name-wide termination.

SIGTERM cleanup is not the application's ordinary Quit acceptance. A startup
deadline is recorded as a timeout, not success. If a child does not exit,
retain the private state/process evidence for an explicit cleanup disposition.

The bounded local gate covers normal production startup, real MCP initialize,
tools/list and lifecycle only. It does not repeat account, adapter, release or
full-suite scenarios. A local result does not prove a successful Glama build,
deployment, release or search listing. The Glama operator performs the platform
test after the candidate review.

## Contracts

The single local Debian trixie/Linux amd64 gate on an emulated arm64 Docker host
built the application successfully and loaded the actual pinned proxy API.
Production Electron then failed before MCP initialize with SIGTRAP and
`Failed to move to new namespace ... Operation not permitted`. The helper was
root:root 4755 and the launcher was nonroot; no security override was attempted.
Initialize, tools/list, ordinary Quit and renderer acceptance remain unverified.
This establishes a boundary of that Docker runtime, not Glama's runtime policy.
Glama must permit Chromium's normal namespace sandbox before this recipe can be
accepted there. A Dockerfile or missing-library change cannot establish that
host permission, and this recipe supplies no sandbox bypass.

- [Glama release configuration](https://glama.ai/blog/2026-03-15-how-to-make-a-release).
- [Pinned proxy HTTP-to-stdio API](https://github.com/punkpeye/mcp-proxy/blob/d283096687420b882bbbd1391cc3770f145252a7/src/startStdioServer.ts).
- [Electron process sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox).
