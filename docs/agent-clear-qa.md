# Explicit agent clearing source review

Reviewed backend and UI: `2528a2e7afc7257c6514d1bb467eaf36a533111c`.
The revoked-restore correction is author commit
`10b40d5081e7c1ead9ff654ce5b4af86d6541319`, integrated as `9e7e1e1`.

Independent source checks passed, including the full 215-test suite after the
store correction. The renderer correction additionally passed all six clear-flow
tests, type checking, formatting and a source build. The build reports the existing
Vite chunk-size warning. Release packages and the package verifier were not run.

The first isolated Electron scenario found that Electron's IPC error prefix
prevented stale previews from refreshing. Deletion remained blocked. The renderer
now recognizes that exact prefix, refreshes the preview and requires another human
confirmation. A regression fails before that correction and passes afterward.

A subsequent scenario completed the deletion actions but asserted the disabled
button before React finished rendering. The test now waits for that UI state.
The final complete scenario passed with no page errors using the actual main,
preload, renderer and service, private profiles and a paired loopback node.

Verified behavior:

- Cancel preserves records and history.
- Selected deletion preserves another agent's processed incoming history.
- A new message invalidates the preview without automatic confirmation.
- MCP deletion followed by same-name recreation clears stale UI history and drafts.
- An old UI incarnation cannot send as the recreated agent.
- All-local deletion preserves peers, adapter profiles, remote records and exports.
- English controls and the Russian confirmation at 1050 × 700 remain readable,
  without global horizontal overflow or technical IDs in the confirmation.

Reproduction after a source build, in a GUI-authorized execution environment:

```sh
node --experimental-sqlite scripts/test-desktop-ui-agent-clear.mjs
```

The script writes synthetic screenshots and a report under `release/`, closes only
its own application and removes only its own temporary profiles. It does not use
the user's preview profile, installed application state or real client settings.
These checks do not establish native package or Windows UI verification.
