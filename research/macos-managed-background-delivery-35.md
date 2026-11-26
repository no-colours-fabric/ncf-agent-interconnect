# macOS background delivery process ownership

26 November 2026. Feedback #35 for NCF Agent Interconnect 1.1.0. Base
`94519243f185338b0e48cb156bd6687d9d4e62d6`. The [delivery integration report](chatgpt-delivery-release-integration-2026-11-26.md)
describes delivery through the normal ChatGPT launch. The new check is whether
disabling that route leaves the ordinary launcher and other processes alone.

The previous receipt recorded the selected profile and login selector URL.
Disable removed the matching selector and receipt but left the App Server
running. The URL, socket, or vendor PID file alone cannot distinguish a process
started by NCF from one independently launched or replaced for that profile.
The vendor's profile-scoped `daemon stop` can address the latter and may escalate
to forced termination. It is unsuitable for product disable. [Vendor lifecycle
source](https://github.com/openai/codex/blob/main/codex-rs/app-server-daemon/src/lib.rs).

The product keeps the vendor start path. It records ownership only for a fresh
`started` result whose PID can be tied to its current UID, executable, process
start time, selected profile and newly inherited launch marker. On the installed
macOS CLI, the returned executable was the `bin/codex` launcher. The kernel
reported the actual `CodexCLI.app` executable in the same vendor release. The
fallback accepts that exact layout and verifies the process against it. A
disposable native trace rejected the initial path-only assumption.

Disable requires the existing selected profile authority. It verifies ownership
again and observes each exact process before requesting the vendor's
graceful-only hangup. It leaves a timed-out or unverified live process and retains
the receipt for retry. A dead or replaced PID is never signaled. The older
receipt format has no process proof and can release its own selector only.
Pre-existing App Servers are reusable and stay outside shutdown. A Home-to-Work
switch retains the prior managed process receipt until disable. Changes to the
selector and ownership state remain in NCF's existing GUI login and private
state boundaries. The profile, profile settings and ordinary launcher are
unchanged.

On a verified selector transition, the successful result contains the exact
profile. It requests a restart only if ChatGPT is running or its running status
could not be confirmed. Status and repeated no-op requests do not report a
restart. No process is terminated to detect whether ChatGPT is running.

## Verification

- Four isolated Node fixtures cover real versus no-op selector transitions,
  a stale external selector, an interrupted profile switch, exact-profile
  success, legacy receipts, and partial shutdown followed by a safe retry.
- The native helper compiled against the macOS SDK. With the installed
  Apple Silicon Codex CLI 0.171.0-alpha.13.2 in two new temporary profiles, it
  rejected an external server and a wrong profile, left the process alive with
  a stale start token, observed its own App Server exit, and accepted a repeat
  without signaling the separately started server. Both fixture profiles were
  disposed of. This isolated check used the vendor stop command only for owned
  fixture cleanup.
- On the renderer revision `512cbd210b8d870719c314e3f33956bce6413cdf`, the
  actual delivery model consumed the macOS host's actions with two temporary
  profiles and real vendor App Servers. The first profile was started by the
  product host. Quick Connect switched to the pre-existing second server. On
  disable the first process exited, the second stayed live, and the model kept
  the exact selected profile. The model showed restart pending for a running
  desktop and no restart for a closed one. The selector and desktop running
  state were injected, and no installed application window was opened.
- The ordinary ChatGPT GUI was neither quit nor relaunched. No GUI login selector
  or working profile was changed. A packaged Home/Work launch, a long active
  turn and any tool-specific descendants still require separate acceptance.
