# OpenCode v1 and v2 setup permissions

Reviewed 25 November 2026. Source: `codex/release-1.1.0` at `14c8ee6`, implementation `7937b26` and documentation `0bbc6c8`.

## Problem and starting point

Determine how setup can remove repeated prompts for normal NCF actions while preserving the owner's existing OpenCode permission policy. Before this change NCF setup configured the server and plugin. The presence of those entries did not establish that each tool was permitted. The v1 and v2 setup paths use different configuration formats and must edit the file actually selected for that major.

## Design and rationale

Both versions preview and add only missing exact `allow` rules for ten named `ncf_agent_interconnect_…` actions on owner **Connect** or **Apply**. Each rule names one action. Clearing history is outside the allowlist. Effective permission is evaluated from the rules already present in the selected file, with the last applicable rule taking precedence. The matcher covers `*` and `?`, and takes a case-insensitive path on Windows for the fixed lowercase NCF action names. A matching effective `ask` or `deny` stops setup before writing. Appending a later allow regardless of an existing restriction would change the owner's effective policy. A broad allow alone also does not count as an existing exact entry.

- **v1** uses the `permission` setting, which can be a scalar policy or an object with action and resource rules. The editor also reads the older Boolean `tools` map. Explicit `permission` rules take precedence for the same action key. Setup retains existing settings and comments and inserts exact rules in the selected JSON or JSONC file.
- **v2** uses an ordered `permissions` array with `action`, `resource`, and `effect`. The exact rules name the action and use `*` for its resource. A permission-only migration keeps the existing target, its credential, and target registration. Configuration for the other major is rejected instead of being rewritten.

## Verification scenarios and results

The integrated candidate passed profile-specific source tests and the isolated macOS Electron UI check. The setup test suite includes these cases:

| Scenario                                    | Established by the tests                                                                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1 clean setup and upgrade                  | Adds ten exact rules for a new configuration, or nine when one already exists. Preview leaves the selected file untouched. Apply backs up the original and preserves unrelated settings and comments. Repeated Apply leaves the result byte-for-byte unchanged. |
| v1 overlapping rules                        | An effective exact or wildcard `ask` or `deny` blocks setup. A legacy `tools` denial blocks setup unless an explicit matching permission replaces its effect. An earlier exact allow does not override a later applicable ask.                                  |
| v2 permission-only upgrade                  | Preview lists missing rules. Discard leaves the file untouched. Apply writes the permissions and retains the target credential and registration. Existing provider and other MCP settings are preserved.                                                        |
| v2 conflict, stale preview, or failed write | An effective restriction stops preview without modifying the selected file or creating target state. A stale preview cannot activate a configuration. Injected failures before activation restore the original file.                                            |
| Major selection and preview                 | v1 and v2 use separate targets and reject the other format. The preview shows only the newly added exact permissions for the selected major.                                                                                                                    |

## What remains unconfirmed

The tests exercise NCF configuration editing, preview, and application state. They do not establish that a running OpenCode process loaded the selected file, that an external profile or policy left these rules in effect, or that an exact connected chat accepted a message. The permission changes in this combined candidate have no recorded native end-to-end acceptance on v1 or v2. In particular, there is no verified live v2 client exchange for the candidate. Existing v1 exact-chat delivery results apply to the earlier adapter and do not validate this permission migration.
