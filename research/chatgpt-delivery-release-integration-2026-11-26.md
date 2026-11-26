# ChatGPT delivery integration for 1.1.0

## Starting state

The candidate starts from `d67fc407626471adb1bb7c6671dc2c2a3695cb9e` and combines
the product changes from Mac `d475be48005a4c6cb77f49a8b867a41e952ba1f5` and Windows
`6201cdf49648a58d5e1107cdb22ba9de5f86bfa1`. Both source histories use
`f5a2f92e3fd88eb83b7dbaee8263454dc7c68da4` as their common base. The Windows bundle
was verified before import. Its SHA-256 is
`15a3d04b71243c619ed1745d19f4e0c2d2eee33905bc1c0b9ed2505ea9f757f9`.

## Integration

- The common path handles exact-chat admission during an active turn and resumes
  a verified unloaded chat when the durable queue evidence matches. Resuming the
  chat does not resend the message, switch tabs or commit a receipt.
- The common setup model handles Connect, profile selection and the settings gear.
  The Mac backend uses the selected profile for the current login and verifies
  the original signed ChatGPT installation. Home and Work remain separate. The
  Windows backend uses the verified default profile, restores eligible legacy
  bindings through its exact profile socket and preserves the vendor-installed
  CLI cache checks.
- The Applications merge retained the base layout and spacing and combined them
  with the profile and restart guidance from the product sources. The attachment
  storage changes remain in place. The packaging hooks compile and verify the
  Windows service assets. Version metadata and installer names remain 1.1.0.
- Prototypes, field installer version changes and the separate restart
  acknowledgment change did not enter the candidate. The reports below record
  earlier native observations independently of this source verification.

## Verification and limits

The targeted source suite on Apple Silicon passed 160 checks with 23
platform-dependent skips and zero failures. It covered the Mac Home/Work
selection and rollback, Codex queue wake and receipt, exact binding delivery,
the vendor resolver with injected Windows discovery, core/UI setup behavior,
and the base agent table and attachment storage. TypeScript and the isolated
Chrome fixture passed. Chrome exercised Applications, Overview, Startup and
Manual setup, with the gear present before and after configuration and before
retrying an error.

The installed Mac and Windows applications and installers were outside this
run. The team previously verified Windows native controls with a corrected
isolated service and preflight. Even when normal installation succeeds, the
first upgrade can still be blocked by an older running Windows background
service. The installed older process still has the old stop matcher. The
candidate retains the checks for active client connections and foreign process
identity, and does not add a force-close fallback.

- [Mac shared-owner wake record](chatgpt-shared-owner-wake-2026-11-26.md)
- [ChatGPT profile selection record](chatgpt-quick-connect-profile-selection.md)
- [Earlier Windows installer shutdown and mixed-version evidence](windows-service-quit-upgrade-20261126.md)
- [Earlier Windows legacy binding recovery evidence](windows-legacy-shared-recovery-20261126.md)
