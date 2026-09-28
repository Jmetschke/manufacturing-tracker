# Current Packages

Current Packages replaces the cleared Active SKUs tab in the employee and administrator pages. The old internal navigation ID remains `activeSkus` so existing navigation keeps working. The production item catalog, Metrc name mappings, equipment inventory, and legacy SKU endpoints are unchanged.

## Files and storage

- `server/current-packages.js`: workbook row normalization, classification, snapshot reconciliation, history, API handlers.
- `public/current-packages.js` and `.css`: shared employee cards and administrator workspace.
- `server.js`: initializes the service and registers routes using the existing Excel reader, workbook-dimension repair, SQL helpers, transactions, and administrator authorization.
- `public/index.html`, `admin.html`, `app.js`, `admin.js`: navigation and asset integration.
- `tests/current-packages.test.cjs`: classification, lifecycle, safety, sorting, and access regression tests.

Startup creates four new tables using the existing `CREATE TABLE IF NOT EXISTS` convention:

- `package_imports`: confirmed import file name, time, and summary.
- `metrc_packages`: unique Tag, normalized Item grouping key, current report fields (JSON), effective classification, active/present flags, first/last seen dates, retirement metadata, and last reconciled import.
- `package_classification_overrides`: persistent manual classification keyed by Tag.
- `package_history`: import and manual-action snapshots, events, timestamps, and import IDs; indexed by Tag.

No new runtime dependencies. Excel reading uses the existing `read-excel-file` and `fflate`. New package data is independent of the one-time legacy SKU reset.

Item grouping normalizes case and whitespace only. It does not merge different Metrc names or use the existing production aliases. The separate `item_key` allows future association with an internal item without changing Tag identity.

## Import behavior

Upload the complete Metrc Active Packages `.xlsx` report. Headers are normalized rather than read by fixed position. Required columns are Tag, Item, Quantity, Unit Of Measure, Location, Production Batch Number, and Source Production Batch. Dates may be blank. Invalid dates, quantities, duplicate Tags, incomplete rows, empty reports, and unreadable workbooks reject the preview.

Batch populated / source batch blank means MASTER. The reverse means SPLIT. Both populated or both blank means REVIEW. Matching source Tags on the same Item add lineage evidence; quantity never determines classification. Manual MASTER, SPLIT, and IGNORED decisions persist through imports. Choosing Automatic removes the override.

Preview does not write package records. It expires after 15 minutes or a server restart. It lists classifications, additions, updates, retirements (including previous quantity and last seen), reactivations, and review packages. Cancellation leaves data unchanged. Confirmation checks that records and overrides have not changed since preview and applies the import in one transaction. A preview with no masters that retires current masters additionally requires explicit acknowledgment. The system cannot determine whether an otherwise valid file is a filtered Metrc export: administrators must confirm it is a complete report.

Existing Tags update in place. Missing packages are retained and marked absent; previously active masters leave the employee queue when missing or no longer classified MASTER. History retains quantities, dates, locations, classification, retirement, and reactivation events. Returning MASTER Tags reactivate the existing record. A master does not need any split children to remain active.

Employees see active MASTER packages only. Within each Item, expiration is used first, then use-by when expiration is absent. Packages with neither deadline follow dated packages and sort by oldest packaged date; ties use packaged date and Tag for deterministic ordering. Missing dates are explicitly labeled; packaged dates are never labeled as expiration. Holds/recalls are displayed when reported; this feature does not infer regulatory eligibility from other report fields.

Administrators can inspect all classifications, retired packages, source/child relationships, import snapshots, and manual history. Search covers Item, Tag, and production batch; filters include classification, status, import snapshot date, and retirement date. Item cards link to the same history workspace. Manually reactivating a package makes it a MASTER; the next confirmed complete snapshot still reconciles its presence.

## API

All routes require the existing application session. All except the employee read additionally require an administrator session on the server.

- `GET /current-packages`: active MASTER records in use order.
- `GET /current-packages/admin`: all current/historical package records.
- `GET /current-packages/imports`: confirmed import history.
- `GET /current-packages/imports/:id/packages`: package snapshots from an import.
- `POST /current-packages/preview`: raw `.xlsx` body, optional `X-File-Name`, maximum 14 MB.
- `POST /current-packages/confirm`: JSON `{token, acknowledge_all_retirements}`.
- `POST /current-packages/:tag/classification`: JSON `{classification: "MASTER" | "SPLIT" | "IGNORED" | "AUTO", reactivate: boolean}`.
- `GET /current-packages/:tag/history`: history and resolved source/child package records.

## Manual checks

1. Open Current Packages as an administrator. Upload a full Metrc report and inspect the preview; cancel once and verify no cards changed.
2. Preview again and confirm. Verify only MASTER packages appear in the employee queue and REVIEW packages remain available in administrator review.
3. Search for an Item, expand its other packages, copy its Tag, and inspect expiration/use-by/packaged labels on a tablet-sized screen.
4. Import a new report with a lower quantity on an existing Tag and an added master. Verify the quantity updates and queue sorts correctly.
5. Import a report missing that first Tag. Inspect its retired record, last known quantity, and per-Tag history. Restore it in a later report and verify its earlier history remains.
6. Classify a REVIEW record as MASTER, re-import it, and verify the override persists. Mark it ignored, then restore automatic classification.
7. Inspect source/child lineage and select a previous import date to see its snapshots. Historical-screen classification actions apply to the current record.
8. Upload malformed, empty, or incomplete files; verify current packages are unchanged. Open two previews, confirm one, and verify the other is rejected as stale.

Run automated tests with `npm test`.
