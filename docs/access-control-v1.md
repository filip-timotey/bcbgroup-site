# BCB User Access Control v1

- Role defaults remain the baseline (`admin` / `editor`).
- Owner can add a per-user allow/deny override for every catalog capability.
- Reset returns a capability to the role default; templates are atomic shortcuts.
- Owner is immutable and always receives every capability.
- Admin-only capabilities cannot be granted to Editor accounts without first changing the account role.
- Navigation reads effective capabilities on every page load and hides unavailable modules.
- Direct navigation to a mapped disabled module redirects to Dashboard.
- Fleet correction controls are loaded only when `fleet.correct` is effective.
- All Owner changes are written to `activity_log`.
- Database RLS and existing role checks remain the underlying data-security boundary; capability navigation is an additional application-access layer, not a replacement for RLS.
