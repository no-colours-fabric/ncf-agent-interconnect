# Client status source verification

LLM-optimized documentation: [llms.txt](../llms.txt).

Product source reviewed: `b7f65eb9067419f34647f5448a99183ebfd99f03`.
The Codex ordering correction is
`016ef768146e0d15642fc623e6aa8a4120e0ccb1`.

Independent checks passed: type checking, formatting, all 244 source tests and a
source build. The build retains the existing Vite chunk-size warning.

An independent reviewer reproduced six bounded fake-IPC scenarios covering stale
results, late uncertain admission, stop, replacement and coalesced recovery. An
additional isolated service/store check retained the uncertain dispatch and unread
message without a fabricated receipt or duplicate submission.

The renderer scenario uses temporary Electron profiles and synthetic snapshots;
it does not start the NCF service or contact client applications. English, Russian
and German were checked at widths of 900 and 1050 pixels. The scenario verifies:

- Verification time appears outside closed details.
- Full and partial Codex summaries describe historical verification.
- Current errors and missing capabilities take priority over old verification.
- A released OpenCode connection remains a warning when admission is uncertain.
- Raw diagnostics and identifiers remain in closed details, with keyboard access
  and escaped hostile text.
- Narrow windows have no global horizontal overflow; tables retain local scroll.

Two renderer runs passed with no page errors. The second adds an explicit Codex
row screenshot because the first screenshot set showed the upper OpenCode card.
Russian and German captures were visually inspected. The report and synthetic
screenshots are written under `release/`.

After a source build, reproduce in a GUI-authorized execution environment:

```sh
node scripts/test-desktop-ui-client-status.mjs
```

No native package, Windows client runtime, live owner recovery or release is
claimed. The accepted user preview, real profiles and client configurations were
not changed during verification. Missing-owner evidence is not treated as proof
of a closed chat or completed task.
