# Calendar save and maintenance notes

## Responsibilities

- `public/admin-calendar-editor.js`: day payload validation, editor lifecycle, save feedback, and conflict recovery.
- `public/admin-calendar-view.js`: calendar loading, navigation, and grid rendering. It ignores stale responses from older overlapping loads.
- `public/admin.js`: shared projection/normalization, task and batch forms, and other admin features. Batch checklist saves include the revision returned by their day read.
- `server/calendar-store.js`: conditional day writes, revision calculation, task-completion retries, and best-effort mirroring.
- `server.js`: HTTP validation, event metadata reconciliation, and legacy event-ID repair.

## Save contract

`GET /schedule` returns a `revision` for each day. An absent day uses `missing`.
`PUT /admin/schedule/:date` requires `base_revision` alongside the existing `tasks` string.
Revisions hash the exact stored content, so they detect writes by another application even if that application does not increment a version or changes content within the same second.

The server checks the supplied revision, then atomically writes only if the stored content still equals the content it read. A concurrent create uses `INSERT ... ON CONFLICT DO NOTHING`. Conflicts return 409; old clients missing a revision receive 428 with a refresh instruction. There is no automatic overwrite or resubmission of a whole-day save.

The editor retains the revision captured when opened, even if the background calendar cache refreshes. Failed saves preserve the form. Reloading the latest saved day requires an explicit discard confirmation. Successful saves render the returned authoritative payload, including server-generated event IDs, without a full schedule/delivery fetch.

Task completion retries its small update against the latest content, rather than writing an outdated whole day. The shared calendar database remains authoritative when configured, and the primary-only fallback remains supported. No schema migration is required for conflict detection.

## Performance and remaining work

Ordinary reads query only the requested date range and do not acquire a write transaction. Legacy/malformed IDs trigger the existing repair path; startup still checks the full calendar. Normal saves read just the edited day. Unfamiliar incoming UUIDs still need the cross-day ownership check.

The existing ten-year lookback remains on calendar navigation: events and multi-day tasks can originate in older source rows. Removing it safely requires a maintained date/overlap index and explicit rules for rescheduled events; narrowing the range blindly can hide entries.

Projection and normalization remain coupled to task/batch helpers in `admin.js`. This is an incremental separation, not a complete calendar rewrite. Whole-day serialization also remains; conflict checks prevent silent overwrites from this app, but do not merge simultaneous edits. Other applications writing directly to the shared database must implement comparable conditional writes to protect their own saves. Task/batch identity still uses existing positions/keys; permanent task/batch IDs are a separate migration.

Primary mirroring remains best effort and is not a cross-database transaction. No Outlook API or sync behavior was added.

## Validation

Run `npm test` with Node 22.13+ (tested with Node 24). Tests use isolated in-memory SQLite databases and simulated frontend responses; they do not access production data. They cover simultaneous create/edit races, stale/old clients, external changes, task completion retries, legacy UUID repair, metadata preservation, targeted query counts, and save button state/error recovery.
