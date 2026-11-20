# 02: D1 schema and migration-branch cutover

**What to build:** A fresh local D1 database contains the final domain schema: the nine retained or reshaped tables, the dropped legacy tables, User credential columns, Scrape Job and Scrape Job Item tables, and no quota tables. Migrations apply with Wrangler, an Admin seed works, and the migration branch stops compiling the legacy Netlify/Postgres path. Production rollback remains the existing `main` deployment.

**Blocked by:** 01 — Preview Worker foundation.

**Status:** resolved

- [x] The schema contains Users, Sessions, Saved Profiles, Saved Leads, User Roles, App Settings, Company Scrape History, Scrape Jobs, and Scrape Job Items.
- [x] Monthly Quotas, Monthly Usage, Tags, Lead Tags, and Lead Positions do not exist.
- [x] Users have one Active Provider (`apify` or `treg`) and one encrypted Scrape Credential (ciphertext, IV, validation timestamp); no per-provider credential table exists.
- [x] Scrape Jobs have a primary key, Owner Scope, provider, provider job reference, job type, input snapshot, status, progress, result count, error message, and timestamps. Scrape Job Items store one Scrape Result per row keyed by job and index with cascade delete.
- [x] SQLite mappings are correct: UUID text identifiers, ISO text timestamps, JSON text columns, integer-backed booleans, integer-backed large numbers, real decimals, cascading foreign keys, owner/URL uniqueness, and composite keys.
- [x] App Settings is a singleton with a fixed identity and an upsert, so duplicate settings rows cannot recur.
- [x] Migrations are generated and applied with `wrangler d1 migrations apply --local`, produce one migration ledger, and do not use the remote-only D1 HTTP path.
- [x] The Admin seed creates a User and role without a quota row; a local smoke verifies inserts, cascade deletion, Scrape Job/Item rows, and chunked identifier handling.
- [x] The migration branch no longer compiles the legacy Netlify/Postgres path; the Worker project typechecks and builds without it.
- [x] No business handler or frontend change is required by this ticket.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `7338356`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Schema/migration, seed, cascade smoke, app+worker typecheck and repo-wide lint verified locally.
