# ChatGPT and sidebar UI feedback for 1.1.0

## Starting point

The isolated round starts from `87c069a9c975d73e0dc40422c2cdb3b84eb5a92a`.
The previous integration kept the Applications gear and Mac profile chooser,
showed restart guidance before a Connect outcome existed, and displayed a
version advisory with an older download link independently of opt-in status.

## Findings and implementation

- For #25 the existing Mac selection and replacement dialogs still govern the
  exact target. The Applications header uses the common layout and retains its
  gear. A confirmed configuration or delivery change opens a mandatory restart
  acknowledgement. Clicking outside or pressing Escape cannot dismiss it.
  A refusal, failure, cancellation or verified no-op does not open it.
- For #27 the sidebar footer uses the same start and stop handlers as the old
  header button. The 44 px power control follows the running state and has a
  localized action name. Search Stop still invokes only the search action.
- For #28 the old compatibility classification cannot establish that delivery
  is off. The warning requires valid version metadata strictly newer than
  `26.1111.71704` and a verified off state. With no selected configured profile,
  a read-only Mac status now reports the same `configuration-required` outcome
  as Windows after verifying no owned login setting. A switch for that outcome
  uses the guarded Connect path and preserves the profile and replacement
  choices. A ready profile uses the existing delivery IPC directly.
- Overview, Applications and manual setup share one delivery snapshot. The
  model serializes renderer-side writes, supersedes stale reads and exposes the
  verified result across surfaces. The manual switch still stages explicit
  consent for a file that has not yet been applied. Startup, Overview and
  Applications use the same preparation, Apply and delivery sequence. The
  Mac acknowledgement is shared across those entry points.
- The old manual form disabled the switch after an unavailable mutation and
  offered a status read. A browser regression exposed that the first shared
  model implementation disabled it only after a read failure. The final form
  disables it for either and retains Check status.

## Verification and limits

Targeted TypeScript and source tests cover the numeric cutoff, 15 locale
strings, version and delivery combinations, exact profile selection, error
recovery and the Mac status for a missing configuration. Isolated Chrome
fixtures cover Applications geometry, the gear before and after Connect,
profile and replacement cancellation, keyboard focus and explicit restart
acknowledgement, all three Connect entry points, the shared switch, and the
sidebar power control at narrow and wide viewport sizes. The browser fixtures
replace Electron IPC. The native Windows cases are platform-dependent. No
installed ChatGPT profile, native installer, release package or publication was
used in these checks.
