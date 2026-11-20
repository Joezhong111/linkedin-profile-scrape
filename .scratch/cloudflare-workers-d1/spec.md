# Cloudflare Workers + D1 migration with user-supplied scrape credentials

Status: ready-for-agent

## Problem Statement

Users currently scrape through an operator-funded Apify token on Netlify Functions backed by Neon PostgreSQL. The operator pays for every Scrape Run, monthly quotas try to contain that cost, profile scrapes can exceed Netlify function timeouts, and users cannot use their own provider account. Saved Profiles also lose fields because persistence reads provider-specific raw keys instead of normalized values, and Admins manage quotas rather than credentials. The app needs a Cloudflare-hosted runtime where each User brings their own Scrape Provider key, quotas disappear, company scrapes stay responsive, and no Neon data has to be carried over.

## Solution

Move the SPA and API to Cloudflare Workers with D1, starting from an empty database that recreates the domain structure. Scraping becomes BYOK: a User configures one Active Provider and one Scrape Credential in a Settings page, and the Worker uses only that credential. Monthly quotas, usage accounting, quota endpoints, and quota UI are removed. Apify and treg remain available. Scrape tiers are reduced to Full and Full+email. Profile scrapes stay synchronous with a cap of 10 URLs; company scrapes become Scrape Jobs that are advanced in chunks and polled by the client. Saved Profiles and Saved Leads are normalized before persistence so provider-specific fields do not become null columns. Admins manage Users, roles, and registration only. Netlify and Neon are removed after cutover, and no production provider token remains on the server.

## User Stories

1. As a returning User, I want to sign in with my email and password, so that I can reach my Saved Profiles and Saved Leads.
2. As a new User, I want to sign up with my email and password, so that I can start using the app.
3. As a User, I want my Session Token to persist across page loads, so that I do not sign in on every visit.
4. As a User, I want sign-out to revoke my Session Token, so that another person on my device cannot reuse it.
5. As a User, I want my password to be verified with the existing salted hash format, so that a fresh D1 database does not require me to learn a new login behavior.
6. As an Admin, I want to create Users, so that I can onboard people without open registration.
7. As an Admin, I want to open or close registration, so that I can control who joins.
8. As an Admin, I want to reset a User's password and delete a User, so that I can handle account support.
9. As an Admin, I want to see which Users have a Scrape Credential configured, so that I can support them without ever seeing their key.
10. As a User, I want a Settings page where I choose Apify or treg as my Active Provider, so that I know which provider my scrapes will use.
11. As a User, I want to paste my Scrape Credential into a write-only field, so that my key is never displayed after saving.
12. As a User, I want my Scrape Credential encrypted at rest, so that a database leak does not expose my provider account.
13. As a User, I want Apify credentials validated when I save them, so that I learn immediately if the token is invalid.
14. As a User, I want treg credentials checked on my first scrape, so that I am not blocked by a validation endpoint that does not exist.
15. As a User, I want a clear error when my Scrape Credential is missing, invalid, expired, or out of balance, so that I know what to fix.
16. As a User, I want to replace or clear my Scrape Credential, so that I can rotate or revoke it.
17. As a User, I want to be told that Apify requires a paid plan to run the actors through the API, so that a free Apify account does not look like an app failure.
18. As a User, I want to be told that treg profiles never include a phone number, so that I do not expect a field that the provider cannot return.
19. As a User, I want to be told that treg email is optional and often missing, so that I understand why a Full+email scrape may return no email.
20. As a User, I want scraping disabled until I configure a Scrape Credential, so that I do not send requests that cannot succeed.
21. As a User, I want to scrape one or more Profile URLs, so that I can capture the people I care about.
22. As a User, I want a cap of 10 Profile URLs per synchronous scrape, so that a long request does not fail unpredictably.
23. As a User, I want to choose Full or Full+email for a treg Profile scrape, so that I can trade speed and cost for email discovery.
24. As a User, I want the Profile tier selector hidden when my Active Provider is Apify, so that I am not offered a choice the actor cannot honor.
25. As a User, I want a warning when Full+email may take around two minutes, so that I do not assume the app is frozen.
26. As a User, I want profile scrape results previewed before saving, so that I can select only the people I want.
27. As a User, I want to save selected Profiles, so that they appear in my Profiles page.
28. As a User, I want re-saving the same Profile URL to update the existing Saved Profile, so that I do not create duplicates.
29. As a User, I want Saved Profiles to contain names, headline, location, email, followers, current job, and company fields when the provider supplies them, so that the list is useful.
30. As a User, I want to search a company and filter by job titles, locations, years at company, and years of experience, so that I can find relevant Leads.
31. As a User, I want to choose Full or Full+email for a company scrape, so that I control cost and email discovery.
32. As a User, I want a company scrape to start as a Scrape Job, so that the request returns promptly and I can see progress.
33. As a User, I want to see progress as the Scrape Job advances, so that I know it is working during a multi-minute scrape.
34. As a User, I want to resume polling after a page reload, so that a long Scrape Job is not lost.
35. As a User, I want the Scrape Job to return deduplicated results when it succeeds, so that the same person is not shown twice.
36. As a User, I want `maxItems` to mean the same thing on Apify and treg, so that switching providers does not change the visible result count.
37. As a User, I want to preview and select Leads, so that I can import only the people I want.
38. As a User, I want to save selected Leads, so that they appear in my Leads page.
39. As a User, I want a failed Scrape Job to show a clear error and no partial saves, so that I can retry safely.
40. As a User, I want a Scrape Job to belong only to me, so that another User cannot read my job or its results.
41. As a User, I want old Scrape Job results removed after 7 days, so that stale data does not accumulate.
42. As a User, I want to list, search, filter, and paginate my Saved Leads, so that I can work with a large book of people.
43. As a User, I want to delete one Lead or many Leads, so that I can clean up my data.
44. As a User, I want to delete a Saved Profile, so that I can remove people I no longer need.
45. As a User, I want to generate and save an AI summary for a Saved Profile, so that I can keep my own notes.
46. As a User, I want my Saved Profiles, Saved Leads, and Scrape Jobs to be visible only to me, so that my Owner Scope is enforced.
47. As a User, I want the app to work on Workers Free where possible, so that hosting stays cheap.
48. As an operator, I want no production Apify or treg token in the Worker, so that I never pay for a User's Scrape Run.
49. As an operator, I want `/api/health` to report readiness without exposing provider secrets, so that uptime checks are safe.
50. As an operator, I want Netlify and Neon removed after cutover, so that there is one deployment target and one database.
51. As an operator, I want a fresh D1 database with no Neon data, so that the migration does not depend on a data copy.
52. As a maintainer, I want the non-quota API contracts frozen by tests, so that the migration does not silently change responses.
53. As a maintainer, I want provider adapters tested with recorded Apify and treg responses, so that mapping and pagination do not depend on live paid calls.
54. As a maintainer, I want Scrape Job ownership and cleanup tested, so that a cross-user job ID cannot leak results and old rows disappear.
55. As a maintainer, I want save normalization tested against both provider shapes, so that switching providers cannot null out Saved Profile columns.

## Implementation Decisions

### Runtime and deployment

- The SPA and API run as one Cloudflare Worker with static assets. `run_worker_first` is scoped to `/api/*`; non-API requests are served by the asset layer and the SPA fallback.
- The Cloudflare Vite plugin is the development and build path. The existing Vite middleware for `/api/health` and `/api/scrape` is removed; `/api/*` goes to the Worker. The input Wrangler config omits `assets.directory` because the plugin sets the client build output in the generated deployment config. Local development serves the SPA on port 5173; port 8787 applies only to a separate `wrangler dev` path, which this project does not use.
- `nodejs_compat` and `nodejs_compat_v2` are explicitly disabled with the negative compatibility flags so that Node-only imports fail fast. Bundle inspection still verifies that `pg`, `apify-client`, and `proxy-agent` are absent.
- Workers Free is the target. Authentication CPU, JSON parsing, subrequest counts, and D1 query counts are benchmarked. If the benchmark exceeds Free limits, the project moves to Workers Paid rather than weakening password hashing or dropping functionality.
- `wrangler` and the Cloudflare Vite plugin are added as development dependencies. `wrangler d1 migrations apply` is the only migration runner; the remote-only `d1-http` Drizzle path is not used, and there is one migration ledger.
- Local secrets live in `.dev.vars`; the file and `.wrangler` are gitignored, with an exception for `.dev.vars.example`.
- Generated Worker types are wired into a separate Worker TypeScript project so DOM and Node globals do not mask Worker APIs. Secret names are present at generation time so `Env` includes them.

### Data model

- D1 starts empty. No Neon rows or sessions are migrated, and no timestamp normalization or reconciliation is needed.
- The final domain tables are Users, Sessions, Saved Profiles, Saved Leads, User Roles, App Settings, Company Scrape History, Scrape Jobs, and Scrape Job Items.
- The quota tables (Monthly Quotas, Monthly Usage), Tags, Lead Tags, and Lead Positions are dropped. No quota or usage columns remain.
- Users gain one Active Provider (`apify` or `treg`) and one encrypted Scrape Credential (ciphertext and IV, plus validation timestamp). No per-provider credential table is added.
- Scrape Jobs gain a real primary key, Owner Scope, provider, provider job reference, job type, input snapshot, status, progress, result count, error message, and timestamps. No reservation or charge fields exist.
- Scrape Job Items store one Scrape Result per row keyed by job and index, with cascade delete from the Scrape Job. This avoids D1's 2 MB row limit.
- Identifiers are UUID strings generated by the Worker; timestamps are ISO strings; booleans are integer-backed; JSON is stored as text with JSON mode; large numeric fields use integer mode; decimal fields use real.
- Foreign keys are enforced by D1 and keep cascade deletes. Owner/URL uniqueness is preserved on Saved Profiles and Saved Leads. Future table-rebuild migrations use `PRAGMA defer_foreign_keys` because D1 ignores `PRAGMA foreign_keys` toggles; initial CREATE-only migrations are unaffected.
- Multi-row writes use `db.batch()` because D1 has no interactive transactions. `inArray` queries are chunked so the total bound parameters stay below 100; chunk size accounts for the other placeholders in the statement.
- App Settings is a single row with a fixed identity and an upsert, so the old duplicate-settings behavior cannot recur.
- A daily Cron Trigger deletes Scrape Jobs and Scrape Job Items older than 7 days. Company Scrape History is retained.

### Authentication

- Authentication keeps opaque Session Tokens: 32 random bytes as hex, stored server-side, 30-day expiry, revoked on sign-out.
- Passwords keep the PBKDF2-SHA512 format (10,000 rounds, 64-byte output, `salt:hash`), implemented with WebCrypto so existing hashes remain verifiable conceptually and fresh hashes use the same format.
- JWT terminology and `JWT_SECRET` are removed from code, docs, environment examples, and comments. `AuthSession` remains the client-facing name for the token plus user payload.

### Scrape Credentials

- The Settings page chooses one Active Provider and stores one Scrape Credential. Switching providers overwrites the credential; there is no credential for the inactive provider.
- Credentials are encrypted with AES-GCM-256 using a Worker secret. The API returns only provider, configured status, and validation timestamp; it never returns the key or a key preview.
- Apify credentials are validated on save with the current-user endpoint. A non-paying plan is surfaced as a warning, not a hard rejection, because plan flags are not a reliable capability signal. A rejected token is not stored.
- treg credentials are stored after format validation and are validated by the first scrape. A provider 401 or 403 produces a clear credential error.
- No server-side Apify or treg token exists in production. Local `.dev.vars` values are only for local smoke tests; automated tests mock the provider HTTP boundary.
- Missing or invalid credentials return a clear `400` error with an actionable message. The frontend links to Settings.

### Scrape Providers and tiers

- The Active Provider determines the provider for every scrape. There is no silent fallback to the other provider; a provider failure returns the provider error.
- The only tiers are Full and Full+email. Short is removed from both profile and company flows and from all provider mappings.
- Company scrapes support Full and Full+email on both providers.
- Profile scrapes with Apify are fixed Full: the actor always attempts email and phone, and the tier selector is hidden with an explanatory label.
- Profile scrapes with treg map Full to the full-profile endpoint and Full+email to the full-profile-with-email endpoint. The email endpoint already returns the full profile, so the two endpoints are never called together. treg never returns phone; email is conditional and often missing.
- Apify calls use the canonical actor and run endpoints with Bearer authentication, not query-string tokens. Run status handling covers all terminal and transitional states, including timing-out and aborting. Dataset responses are treated as bare arrays. Log-line counting is removed; statistics come from returned items.
- treg calls use the direct call endpoint with the treg token header, GET query parameters only, and no JSON body. Profile responses are read from the provider element; company search responses are read from the provider elements array. HTTP 200 is not treated as success until the provider status, error, and element presence are checked.
- treg company search paginates 25 rows per page, deduplicates by Profile URL, truncates to `maxItems`, and enriches each row with the selected profile endpoint. Concurrency is capped at five. Idempotency keys are used per logical call; 409, 410, and 422 are handled explicitly; 429 honors the retry delay.
- Filter limits are validated per Active Provider: Apify accepts at most 50 locations and 50 job titles; treg accepts at most 70 of each. Years-at-company and years-of-experience IDs are passed as the provider expects.
- `maxItems` is applied server-side for Apify and client-side for treg, but the visible result is truncated to the same count after deduplication.

### Scrape Jobs

- Company scrapes create a Scrape Job owned by the requesting User. The response returns a job identifier and a running status. Company `maxItems` remains capped at 100.
- The client polls a job status endpoint. Each poll advances a treg job by at most five profiles; for Apify it checks the provider run once.
- Job status values are pending, running, succeeded, and failed. Responses include progress and result count; succeeded responses include items and statistics.
- Job IDs are owner-scoped. A job ID belonging to another User returns not found or forbidden, never items.
- Apify providers store the provider run reference and copy dataset items into Scrape Job Items when the run succeeds.
- treg providers write each enriched Scrape Result into Scrape Job Items as it completes, so a later poll can return the full result set.
- The frontend persists the active job identifier locally so a reload resumes polling. Polling stops on success or failure; abandoned jobs are cleaned up by the 7-day job cleanup.
- Profile scrapes remain synchronous and return a bare array. They are capped at 10 URLs. Apify profile scrapes start a run, wait for completion within the request, and read the dataset; treg profile scrapes call the selected endpoint per URL with concurrency five.

### Persistence and normalization

- Saved Profiles and Saved Leads are written from normalized values first and provider raw data second. The normalized mapper must cover both the Apify dev_fusion shape and the HarvestAPI shape.
- Profile URL is required. Missing provider variants fall back without nulling fields that another key supplied.
- HarvestAPI-specific renames are normalized before persistence: email arrays, follower and connection counts, experience and education shapes, location parsing, current positions, company URLs, and verified/premium flags.
- The existing raw payload is retained for fidelity, but it is not the primary source for stored columns.
- Company Scrape History continues to store the projected new-profile count at scrape time; reconciling it with later saves is out of scope.

### API contracts

- Authentication endpoints keep their existing paths and payloads.
- Profiles endpoints keep their existing paths; the list returns a bare array, and save/delete/update-AI keep their current shapes.
- Leads endpoints keep their existing paths; the list returns the paginated envelope and its `total` is a number, not a string.
- Profile scrape keeps its path and returns a bare array. Missing credentials return `400`; provider failures return `502` with a readable message.
- Company scrape keeps its path and returns a job identifier plus running status instead of a provider run identifier.
- Job status keeps the existing status path and accepts a job identifier. The response preserves running, succeeded, and failed semantics and adds progress.
- Account credential endpoints expose read, upsert, and delete operations for the Active Provider and Scrape Credential status.
- Health returns a generic readiness payload and the two supported provider names; it does not reveal whether a server token exists.
- The admin quotas endpoint and all quota fields in admin responses are removed. Admin user responses include whether a credential is configured, never the key.
- Admin create-user no longer writes a quota row.
- Error bodies remain readable text or JSON with an `error` field, matching the frontend's dual handling.

### Frontend

- A Settings page is added to the hash router and navigation. It shows the Active Provider, credential status, validation timestamp, save/replace/clear controls, and provider-specific warnings.
- The scrape page shows the Active Provider as read-only. It shows Full and Full+email for treg profile scrapes, hides the tier for Apify profile scrapes, and shows Full and Full+email for company scrapes on both providers.
- The profile form enforces the 10-URL cap and warns about Full+email latency.
- The company form polls with a job identifier, shows progress, and resumes after reload.
- The Admin page removes quota columns, quota editing, and usage bars; it keeps Users, roles, password reset, delete, and registration toggles.
- The health-driven Apify readiness warning is removed; readiness is based on the User's configured credential.
- `VITE_APIFY_TOKEN` and the old Vite scrape middleware are removed.

### Operations and cleanup

- The Cloudflare Worker is deployed from the migration branch to a preview host with a preview D1 database, then merged to main and cut over.
- Netlify remains deployable only until the Cloudflare version is merged. After merge, Netlify configuration, functions, and dependencies are removed.
- No Neon data is copied. A pre-cloudflare code tag preserves the old deployment for code rollback only.
- Provider credentials are never logged, included in error responses, or returned to the client. Provider error bodies are preserved but redacted of tokens.
- The migration plan is rewritten after this spec is accepted; the old Apify-REST-first and quota phases are obsolete.

## Implementation Sequence

The order is dependency-driven. Every phase runs typecheck, lint, tests, build, and `wrangler deploy --dry-run`; no phase starts before the previous phase's gate passes. This sequence supersedes the old phase order in `note.md`.

### Phase 0 — Foundation and D1 schema

1. Create the migration branch and add the runtime, Wrangler, Cloudflare Vite plugin, and Workers Vitest dependencies. Raise Vitest to the plugin's supported range.
2. Add the Wrangler configuration: Worker entry, static assets with SPA fallback, `/api/*` first, D1 binding, observability, no `assets.directory`, and explicit negative Node compatibility flags.
3. Rewrite the schema for SQLite: the nine retained/updated tables, the five dropped tables, User credential columns, Scrape Job and Scrape Job Item tables, ISO text timestamps, JSON text columns, boolean/integer mappings, UUID defaults, foreign keys, and the App Settings singleton.
4. Generate the D1 migration, apply it with Wrangler, and establish one migration ledger.
5. Add the local admin seed that creates a User and role but no quota row; add a smoke check for inserts, cascade deletes, and chunked identifiers.
6. Gate: schema and migrations apply locally; no business handler, Worker fetch entry, or frontend change is required yet.

### Phase 1 — Worker skeleton, assets, and health

1. Add the Worker fetch entry with `/api/health` and a not-implemented response for other API paths.
2. Configure static assets and SPA fallback; confirm non-API paths do not invoke the Worker.
3. Remove the old Vite API middleware; wire the Cloudflare Vite plugin; add `.dev.vars` handling and Worker type generation.
4. Gate: SPA and health work on the preview host; the bundle has no Node-only dependencies; Netlify production is untouched.

### Phase 2 — Authentication, core CRUD, and Scrape Credentials

1. Port the session-token auth flow to WebCrypto and per-request D1; update auth endpoints and current-user lookup.
2. Port Profiles and Leads CRUD, lists, filters, pagination, batch delete, company history, and Admin user/role/registration endpoints. Enforce Owner Scope on every saved record and job.
3. Remove quota checks, quota tables, quota endpoints, and quota writes. Admin create-user no longer creates a quota row.
4. Add the Scrape Credential service and account endpoints: one Active Provider, encrypted credential at rest, Apify save-time validation, treg lazy validation, write-only responses, replace and clear.
5. Gate: auth, Profiles, Leads, Admin, and credential flows pass contract tests; the quota surface is gone; no scrape provider is called yet.

### Phase 3 — Provider adapters, profile scrapes, and company Scrape Jobs

1. Implement the provider boundary for Apify and treg with the Full / Full+email tier mapping and no silent fallback.
2. Implement synchronous Profile scrapes: 10-URL cap, Apify fixed Full, treg Full / Full+email, provider error mapping, and provider-specific warnings.
3. Implement company Scrape Jobs: job creation, owner-scoped polling, five-profile treg chunks, one Apify run check per poll, item persistence, progress, success and failure, resume, and cleanup.
4. Normalize Scrape Results before Saved Profile and Saved Lead persistence for both provider shapes; keep raw data as fallback.
5. Gate: both providers work through the same HTTP surface; job ownership and cleanup pass; save normalization covers both fixtures; no server provider token is required.

### Phase 4 — Frontend and Admin

1. Add the Settings page and navigation entry.
2. Update the scrape pages for the Active Provider, tier rules, profile cap and warning, job polling, and reload resume.
3. Remove quota UI and quota-driven warnings; update Admin to user and registration management only.
4. Remove the `VITE_APIFY_TOKEN` path and the old health-driven readiness warning.
5. Gate: end-to-end login, credential setup, Profile scrape, company Scrape Job, save, list, delete, and Admin flows pass on the preview host.

### Phase 5 — Cutover and cleanup

1. Run the final contract, provider, job, and smoke suites; inspect the bundle and the Wrangler dry run.
2. Merge to main, deploy the Worker, and move the production domain.
3. Remove Netlify configuration, functions, and dependencies; remove Neon references, `DATABASE_URL`, `JWT_SECRET`, `VITE_APIFY_TOKEN`, `apify-client`, `pg`, and the old PostgreSQL migrations. Replace the PostgreSQL-only health and admin scripts with D1 equivalents and update package scripts for the Worker deployment path.
4. Update README, AGENTS.md, GLOSSARY.md, ADRs, environment examples, and rewrite the migration note.
5. Gate: one production deployment target, no Netlify or Neon references in running code, and the pre-cloudflare code tag remains for code rollback only.

## Testing Decisions

- A good test exercises external behavior: HTTP status, response body, persisted rows, Owner Scope, job transitions, and provider request shape. Tests do not assert implementation details, private functions, source text, or mock call echoes.
- The primary and preferred single seam is the Worker HTTP entry. Tests call the Worker's fetch handler with a local D1 database and a mocked outbound provider fetch. This exercises routing, authentication, credentials, handlers, provider adapters, persistence, and job transitions without duplicating a second seam.
- Tests run inside the Workers runtime with the Cloudflare Vitest plugin, which supports D1 bindings and isolated per-test storage. The repo's Vitest version is raised to the plugin's supported range. Vitest configuration uses the Worker project rather than the browser project.
- The local D1 schema is created by applying the generated D1 migrations, not by inventing a separate test schema.
- Contract tests freeze the non-quota API surface: authentication, Profiles CRUD, Leads CRUD and pagination, Admin user management, health, and the scrape item shape. Characterization fixtures are captured from the current Netlify behavior with a fixed database and then replayed against the Worker; quota endpoints are excluded because they are removed. The numeric `total` in the Leads envelope is an intentional change.
- Provider adapter tests use recorded Apify and treg responses through the mocked outbound fetch. They cover canonical Apify paths and Bearer auth, run status transitions, dataset parsing, treg profile and search responses, pagination, deduplication, truncation, enrichment, idempotency, provider error bodies, and rate-limit handling.
- Credential tests cover encryption at rest, write-only API responses, missing credentials, invalid tokens, provider switching, replacement, and deletion.
- Scrape Job tests cover creation, owner isolation, chunk progression, success items, failure, progress reporting, reload resume, and 7-day cleanup.
- Persistence tests cover save normalization with both the dev_fusion shape and the HarvestAPI shape, including fields that are missing, renamed, or derived.
- D1 limit tests cover batch delete with more than 100 identifiers, chunked `inArray` queries with additional placeholders, and multi-write atomicity.
- Prior art is limited to the placeholder example test. The Worker test suite is new; there is no existing handler-level test convention to preserve.
- Tests are deterministic: no live provider calls, no wall-clock sleeps, no network access, and no shared state between files.

## Out of Scope

- Migrating Neon rows, sessions, or timestamps into D1.
- Phone or mobile numbers from treg.
- Company firmographics (industry, size, founded year) from treg.
- The Short tier.
- Per-provider credentials, credential auto-detection, and key rotation workflows.
- Rate limiting, abuse protection, and per-user caps.
- Usage analytics, quota reporting, and billing.
- Cloudflare Queues, Workflows, Durable Objects, or background processing beyond client-driven job polling.
- Changes to AI summary generation or its Gemini integration.
- Tags and lead-position UI; their tables are dropped.
- Automated DNS cutover, custom-domain provisioning, and a data rollback window.
- Changes to Apify actor code or pricing.

## Further Notes

- Functional parity is uneven: treg profiles have no phone field, email is conditional with an observed hit rate around 15.6%, and treg lacks company industry, company size, founded year, retired status, exact employment/open-connection flags, and exact recommendation totals. treg gains verified/premium flags, structured experience and education, parsed location, email validation metadata, and a 70-value filter limit.
- Apify profile scraping requires a paid Apify plan when run through the API; the Settings UI must state this.
- The repo sample raw payload is a HarvestAPI-shaped company item, not a dev_fusion profile item. It must not be used as proof that the current profile save path is correct.
- The old `note.md` phases are superseded: the Apify REST phase uses user credentials and canonical endpoints, the treg phase is core rather than optional, and the quota phase is deleted.
- Workers Free is a cost target, not a correctness constraint. Authentication CPU, JSON parsing, D1 query counts, and provider subrequests are measured before choosing Free or Paid.
- Company Scrape History's saved count remains a projection at scrape time; actual save reconciliation is a separate concern.
- The single test seam is the Worker HTTP entry with mocked provider fetch. If a different seam is preferred, that is a deliberate change to this spec, not an implementation detail.
