# ChatGPT setup in Applications on macOS

The owner connected a Home profile first and later selected a work profile. The field installer could show a generic setup failure with an expandable raw error. Its background delivery control appeared in Applications only after setup succeeded.

The previous automatic path used the shortcut resolver, whose single-process and desktop data requirements could return no target. The Connect flow translated that result into a generic failure. The exact process state during the original failure was not captured. The new setup path uses the owner's saved choice, an explicitly selected manual draft, or verified profiles from the installed desktop. Multiple verified profiles prompt for a selection. Inconclusive discovery can offer known locations for an explicit selection. The existing guarded configuration writer still handles replacements and backups.

The Applications action applies the selected configuration and enables background delivery after successful Apply, including when the file already matches. A failed or uncertain delivery step can be retried independently of the configuration write. Manual setup offers the delivery switch before Apply, and a draft configuration can be selected there and applied later with Connect. Alpha-4 linked the ChatGPT name to manual setup. The owner could not find the setting through that link. The follow-up restores the original visible settings gear in the Applications row. In a browser fixture it opened manual setup before and after connection, after a failed connection and with automatic discovery unavailable. Restart guidance replaces the technical error disclosure. New user-facing strings are provided in all 15 locales.

On macOS the saved delivery setting can switch between two profiles owned by NCF. If publication fails partway, the prior ownership record remains usable. A foreign selector remains untouched. Tests cover switching profiles, close-required recovery, avoiding duplicate writes, multiple open profiles, and exact-target submission. The browser fixture exercised Applications, Overview, startup and manual setup with isolated data. A read-only check of the compiled profile inspector identified the currently running work profile. No installed configuration or login setting was changed by this investigation. The Windows field installer predates these changes.

## Applications restart acknowledgement

The restart change from `d1df73c` was applied to the manual-setup gear baseline `d475be4`.
Before this change the ChatGPT row included restart text before Connect, which
gave it a different structure from the other rows. The ordinary row now uses
the same header grid. The shared manual setup gear and compatibility notice remain.

The confirmation belongs to a macOS Applications Connect attempt and stays
associated with it through profile selection and replacement review. The
dialog requires a successful configuration change or a confirmed background
delivery change for the selected profile. An unchanged file with an already
enabled profile, a refusal, and a canceled choice produce no success dialog.
The selected profile chooser closes when the selection begins, so it cannot
present a second cancellation path during Apply. After acknowledgement, focus
returns to the ChatGPT card because Connect can disappear after setup.

An isolated Chrome fixture compared ordinary ChatGPT and Cursor row geometry
at 640 and 1280 px and exercised the shared dialog theme. It covered Home and
Work choices, profile and replacement cancellation, Apply failure, delivery
refusal, no-op success, and the non-macOS scope. Escape and backdrop clicks kept
the acknowledgement open, while the focused button closed it and restored
focus. The gear stayed available after acknowledgement and opened the actual
manual setup view without repeating Apply. The fixture used mock IPC and did not alter an installed application
or exercise native packaging.
