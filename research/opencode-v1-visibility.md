# OpenCode v1 setup visibility

Reviewed 25 November 2026 for 1.1.0 issue #4. Starting revision: `d21566cb2b06e6d831a03a8a5e90c7acb31810b9`.

## Starting state

The Applications rows and compact setup list both initialized the OpenCode v1 switch to off. Application discovery reported the product and installation form without identifying the major. Configuration status reported NCF setup completion and could be unavailable when an otherwise valid v1 file explicitly denied an NCF tool.

OpenCode v1 and v2 share the executable name, config filenames, config locations, and some JSON settings. A shared schema URL, a bare executable, and a config containing only common fields are insufficient to identify v1. A v2 installation can also continue to use a v1-format file. The configuration and installation signals are therefore independent. [OpenCode migration guide](https://opencode.ai/docs/migrate-v1/)

## Implementation

- Setup status reads the existing known v1 targets, including remembered, explicit environment, and global JSON/JSONC alternatives. It recognizes legacy provider, plugin, permission, tools, and direct MCP server forms. Native v2 forms and malformed, unreadable, or version-neutral files do not provide the v1 signal. Existing setup eligibility, selected targets, and exact permissions retain their own rules.
- Discovery supplies a major only after existing identity checks, from a bundle version, package/product manifest, Windows PE product version, the owned Linux package version, or a canonical versioned Homebrew installation. Unversioned native installations retain product-only detection. Discovery never executes the identified OpenCode binary.
- Both switches use v1 configuration or verified v1 installation as the default. A deliberate switch change takes precedence over subsequent status or discovery results while that interface remains mounted. The separate startup offer dialog and Overview cards have no version switch.

## Verification boundaries

Source tests render both switches with each combination of configuration and installation evidence, including v2-only and unversioned installations. Metadata fixtures exercise macOS, Windows and Linux discovery paths. An isolated configuration fixture checks that status reads preserve files and create no setup state, including when an existing permission denies an NCF action. The exact permission editor and v2 permission-only migration remain covered by their setup tests. There was no native OpenCode session, installer build, or verification against arbitrary portable binaries.
