# Windows ChatGPT reconnect: protected MSIX CLI execution

NCF Agent Interconnect is the application and project. NCF abbreviates No Colours Fabric.

## Problem and starting state

After a normal ChatGPT restart/update, the existing Windows binding remained present but automatic delivery was unavailable. The adapter reported Codex IPC: ENOENT. Reconnecting the same nickname and credential failed with a generic saved-chat, queue or transcript error. Manual MCP exchange worked, which did not establish automatic delivery. Source baseline: f5a2f92e3fd88eb83b7dbaee8263454dc7c68da4, unreleased NCF Agent Interconnect 1.1.0. Current running ChatGPT MSIX: 26.1120.6357.0; previous tested MSIX: 26.1111.9664.0.

## Investigation and verified mechanism

The exact saved chat, profile and binding generation remained unchanged. Its legacy named pipe was absent. The default profile's control directory existed without a control socket. A missing shared control socket is expected for an ordinary launch and is not itself the cause: the adapter has a passive stdio fallback.

The fallback located the current registered package correctly and selected app/resources/codex.exe. This file existed and was canonical, but spawning it returned EPERM before initialize. The refusal reproduced outside the agent terminal sandbox and from the installed NCF Electron runtime in run-as-Node mode, without starting a GUI. Consequently it was not a thread/read, queue, projection or transcript failure.

The existing Windows launcher already resolves the vendor-created cache by hashing four assets in the currently registered package, deriving the exact cache key, and requiring canonical non-reparse files with matching sizes and hashes. Reusing that resolver found the byte-identical CLI in the existing vendor cache. No file was copied, downloaded or repaired; no ACL, package registration, PATH, client configuration or binding was changed.

With the verified cached CLI, a bounded read-only native probe passed initialize with experimentalApi, exact thread/read, thread/queue/list limit 1, thread/items/list limit 1, and transcript filename, profile scope, canonical-file and single-link checks. The independent passive server reported notLoaded; this does not establish active-turn ownership. No thread resume/start/steer or queue mutation was invoked.

## Narrow correction

Only Windows passive queue executable selection changes: discover one exact installed package, then reuse the existing strict vendor-cache resolver. Mac and Linux executable selection, RPC methods, thread checks, transcript checks, message admission and uncertain-admission handling are unchanged. Missing, ambiguous, tampered or reparse cache state remains a failure; the fix does not choose an old cache or arbitrary executable, nor create the vendor cache.

## Verification and limits

- TypeScript passed.
- Queue and new resolver fixtures: 30 passed, no failures or skips.
- Existing exact four-file vendor-cache fixture: 1 passed, covering missing cache, valid cache and tampering.
- The new default source resolver passed against the actually registered current Windows package and returned the exact CLI hash used in the successful read-only protocol probe.
- The first diagnostic script had a relative module-path typo before vendor resolution; it was corrected before the successful cache probe. It made no product or profile changes.
- Native packaging and its verifier are recorded separately in retained local QA. Live installed-client delivery and recovery after an owner-performed update/restart remain separate acceptance. No immediate delivery guarantee is inferred for newer ChatGPT versions.

Related historical work: research/.local/windows-reconnect-unavailable-20261125.md records the initial generic-error localization; local QA windows-reconnect-20261125 retains sanitized native probes and test logs. Private identifiers, profile paths, message text and credentials are intentionally excluded here.
