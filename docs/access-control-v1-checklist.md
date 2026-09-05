# Rollout verification

- Owner Command Center loads active profiles and capability catalog.
- Role default toggles call `owner_set_role_capability`.
- Per-user toggles call `owner_set_user_capability`.
- Reset removes an override and restores role inheritance.
- Quick templates apply atomically.
- Owner access is immutable.
- Editor accounts cannot receive Admin-only capabilities.
- Effective capability RPC works for self and Owner target lookup.
- Navigation falls back to legacy role navigation if capability sync fails.
- Disabled mapped modules are removed from navigation and direct navigation redirects to Dashboard.
- Fleet correction scripts require `fleet.correct`.
- Security Advisor has no new capability-function warnings.
