# Cloudflare Workers + D1 deployment

This project runs as one Cloudflare Worker (`worker/index.ts`) that serves the
`/api/*` routes, the built SPA through the `ASSETS` binding, and a daily Cron
Trigger. Data lives in D1; there is no Postgres or Node-only database, scraping,
or proxy package in the Worker bundle. Provider tokens are supplied per User in
Settings and stored encrypted in D1.

Preview and production are separate Workers with separate D1 databases. Local
tests and `pnpm dev` use the top-level configuration, which keeps a placeholder
database id.

## Requirements

- Node.js 20.19+
- pnpm 9+
- A Cloudflare account with Workers and D1 enabled
- `wrangler` (installed locally; use `pnpm exec wrangler`)
- The `pre-cloudflare` tag for rollback (see [Rollback](#rollback))

## 1. Configuration and D1 databases

`wrangler.jsonc` defines the local/test default plus two deploy environments:

| Target | Worker name (automatic suffix) | D1 database |
| --- | --- | --- |
| top level (tests/local) | `linkedin-insights-pro` | `linkedin-insights-pro` (placeholder id) |
| `env.preview` | `linkedin-insights-pro-preview` | `linkedin-insights-pro-preview` |
| `env.production` | `linkedin-insights-pro-production` | `linkedin-insights-pro` |

`main`, `assets`, `triggers`, and `observability` are inherited from the top
level. D1 bindings are **not** inherited, so each environment declares its own.
The checked-in database ids are valid placeholders so `wrangler deploy
--dry-run` works offline; replace them before a real deploy.

```bash
# Human-gated: creates the two remote databases and prints their ids.
pnpm exec wrangler d1 create linkedin-insights-pro-preview
pnpm exec wrangler d1 create linkedin-insights-pro
```

Copy each printed `database_id` into the matching `env.preview` /
`env.production` block in `wrangler.jsonc`. Do not reuse one database id for
both environments.

## 2. Secrets

`CREDENTIAL_ENCRYPTION_KEY` is a base64-encoded 32-byte AES-GCM key. It is
**only** a Worker secret; it is not a `vars` entry and no value belongs in the
repository. Generate one per environment (preview and production should not
share it):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set it on each Worker (human-gated, prompts for the value):

```bash
pnpm exec wrangler secret put CREDENTIAL_ENCRYPTION_KEY --env preview --config wrangler.jsonc
pnpm exec wrangler secret put CREDENTIAL_ENCRYPTION_KEY --env production --config wrangler.jsonc
```

`APIFY_TOKEN`, `TREG_TOKEN`, and `SCRAPE_PROVIDER` are intentionally **not**
bindings: each User saves their own Scrape Credential through
`PUT /api/account/credentials`, encrypted at rest.

For local development, copy `.dev.vars.example` to `.dev.vars` (gitignored) and
set a test key:

```bash
cp .dev.vars.example .dev.vars
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# paste the value after CREDENTIAL_ENCRYPTION_KEY= in .dev.vars
```

The local smoke below used the deterministic test key
`MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=` in `.dev.vars`. That file was
removed after the smoke; create your own before running `pnpm dev`. Never use a
known key in preview or production.

## 3. Migrations

The Vite plugin writes a generated deployment config, so D1 commands should
pass `--config wrangler.jsonc` to select the environment binding directly.

```bash
# Local (top-level database, used by pnpm dev)
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc

# Local preview database (optional; verifies the env binding)
pnpm exec wrangler d1 migrations apply DB --local --env preview --config wrangler.jsonc

# Remote (human-gated)
pnpm exec wrangler d1 migrations apply DB --remote --env preview --config wrangler.jsonc
pnpm exec wrangler d1 migrations apply DB --remote --env production --config wrangler.jsonc
```

## 4. Admin seed

The seed script uses the same PBKDF2-SHA512 parameters as the Worker and writes
the `users` + `user_roles` rows directly. `--env` selects the environment D1
binding; omit it for the top-level local database.

```bash
# Local (executed during this ticket's smoke)
node scripts/create-admin-d1.mjs admin@example.com 'local-admin-password' --local

# Local preview database (executed, verifies --env support)
node scripts/create-admin-d1.mjs preview-admin@example.com 'preview-admin-password' --local --env preview

# Remote (human-gated)
node scripts/create-admin-d1.mjs admin@example.com '<strong-password>' --remote --env preview
node scripts/create-admin-d1.mjs admin@example.com '<strong-password>' --remote --env production
```

## 5. Build and deploy

The deployment config is generated per target. Build with `CLOUDFLARE_ENV`
before deploying, otherwise the generated config carries the top-level D1
binding:

```bash
# Preview (human-gated: deployment)
CLOUDFLARE_ENV=preview pnpm build
pnpm exec wrangler deploy --dry-run --env preview
pnpm exec wrangler deploy --env preview

# Production (human-gated: deployment)
CLOUDFLARE_ENV=production pnpm build
pnpm exec wrangler deploy --dry-run --env production
pnpm exec wrangler deploy --env production
```

Plain `pnpm build` targets the top-level configuration and is what the
typecheck/lint/test/dry-run gate uses. The deploy dry-run reads
`dist/linkedin_insights_pro/wrangler.json`; the Worker names above are the
default `<name>-<env>` suffix.

## 6. Cron and observability

- **Cron**: `0 3 * * *` (03:00 UTC daily), inherited by both environments.
  `scheduled()` calls `cleanupOldJobs`, which deletes Scrape Jobs and their
  items older than seven days. Company Scrape History is intentionally
  retained.
- **Observability**: `observability.enabled: true` at the top level, inherited
  by both environments. Workers Logs captures invocations, exceptions, and CPU
  time after deploy.

Both were confirmed in the generated deploy config (see [Verification](#9-verification-performed-in-this-ticket)).
Live log streaming (human-gated):

```bash
pnpm exec wrangler tail --env production --config wrangler.jsonc
```

## 7. Rollback

- **Worker**: redeploy the last known-good commit, or roll back a Worker
  version:
  `pnpm exec wrangler rollback --env production --config wrangler.jsonc`
  (with an explicit version id when needed).
- **Code**: the `pre-cloudflare` tag marks commit `9b3b369`, the last commit on
  `main` before the Worker/D1 migration. It preserves the old code for
  inspection or a deliberate reconstruction. It is **not** a second supported
  deployment target: the old deployment configuration, functions, and
  dependencies were removed at cutover, so rolling back to it requires
  recreating that infrastructure.
- **Data**: there is no data rollback. D1 data written after cutover stays in
  D1; legacy data is not migrated back automatically. If the old stack is still
  live during the cutover window, DNS can be pointed back to it before
  decommissioning, but that window ends when the old project is deleted.

## 8. Workers Free limits measurement

### Methodology

`test/limits.test.ts` runs inside workerd through the real Worker routes:

- **D1 queries**: `env.DB` is wrapped in a `Proxy`; every `prepare` call is
  counted. Drizzle prepares one statement per query, including each statement
  in `db.batch()`.
- **Subrequests**: global `fetch` is stubbed and every outbound call is
  counted. Provider calls use the same URLs and headers as production.
- **Auth CPU proxy**: 20 real `POST /api/auth/signin` invocations through
  `worker.fetch`; the median wall-clock is recorded. A separate run measures
  `hashPassword` (PBKDF2-SHA512, 10,000 iterations, 512 bits) without D1.
- **JSON parsing**: workerd's clock has 1 ms resolution here, so each sample
  parses 1,000 times and the median is reported per parse (20 samples).
- **Environment**: Apple arm64, local workerd/Miniflare, local D1, stubbed
  provider responses. No Cloudflare fleet measurement was possible without
  credentials.

Run the evidence-producing reporter:

```bash
pnpm bench:limits
```

### Measured results

Workers Free per-invocation limits: **10 ms CPU**, **50 subrequests**,
**50 D1 queries**. Every measured value is below the limit.

| Invocation | D1 prepare calls | Subrequests | Timing |
| --- | ---: | ---: | --- |
| `POST /api/auth/signin` | 3 | 0 | median 2.00 ms wall-clock (min 2.00, max 3.00) over 20 runs |
| PBKDF2 hash only | — | — | median 2.00 ms (min 1.00, max 2.00) over 20 runs |
| `GET /api/profiles/list` | 2 | 0 | — |
| `GET /api/leads/list` | 4 | 0 | — |
| `POST /api/leads/batch-delete` (100 ids, two chunks) | 3 | 0 | — |
| `POST /api/scrape_company` (Apify start) | 2 | 1 | — |
| `GET /api/check_scrape_status` (Apify running poll) | 3 | 1 | — |
| `GET /api/check_scrape_status` (Apify success poll, 100 items) | 15 | 2 | — |
| Apify profile scrape (worst case: start + polls every 5 s for 120 s + dataset) | 0 | 26 | 120 s wait |
| `POST /api/scrape` (treg, 10 profiles) | 1 | 20 | profile + phone per URL; provider concurrency 5 |
| `POST /api/scrape_company` (treg, 10 search pages) | 2 | 10 | page cap |
| `POST /api/scrape_company` (treg, 2-page fixture search) | 2 | 2 | — |
| `GET /api/check_scrape_status` (treg enrichment chunk) | 9 | 6 | 3 candidates; profile + phone each |
| `JSON.parse` profile item (2,189 chars) | — | — | median 0.0020 ms/parse |
| `JSON.parse` 100-item company dataset (31,371 chars) | — | — | median 0.0180 ms/parse |

Maximum observed: **15 D1 queries** (30% of Free), **26 subrequests** (52% of
Free, the Apify profile worst case), and **2.00 ms** sign-in wall-clock (20% of
the Free CPU budget), with PBKDF2 itself also at 2.00 ms.

### Decision: Workers Free is sufficient

Reasons:

1. The highest D1 count is the 100-item Apify success poll at 15/50; ordinary
   reads are 2–4. Batching and chunk sizes stay well below D1's limits.
2. The highest subrequest count is the Apify profile worst case at 26/50
   (`ceil(120 s / 5 s) + 2`); treg's 10-URL cap uses 20 (profile + phone per
   URL), a company poll at most 10, and a 10-page search uses 10.
3. PBKDF2-SHA512 sign-in costs about 1.5–2 ms locally. Auth still uses the full
   10,000 iterations and 512-bit output; nothing was weakened to fit Free.
4. Profile/company JSON parsing is negligible next to the 10 ms CPU budget.

Caveats: these are local workerd measurements, not Cloudflare fleet CPU
numbers, and D1 was local. Before production traffic, check the preview
Worker's CPU time in Workers Logs. Revisit Paid if p95 CPU approaches 8 ms, if
PBKDF2 iterations increase, or if a provider path starts issuing bulk requests.
Free plan daily request/row quotas are separate from these per-invocation
limits and depend on traffic; they were not evaluated here.

## 9. Verification performed in this ticket

Local commands and observed results (no provider calls, no Cloudflare login):

| Command | Observed |
| --- | --- |
| `pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc` | local DB up to date (`No migrations to apply!`) |
| `node scripts/create-admin-d1.mjs admin@example.com 'local-admin-password' --local` | seeded `admin@example.com` with role `admin` |
| `node scripts/create-admin-d1.mjs preview-admin@example.com '...' --local --env preview` | seeded role `admin` in preview local D1 |
| `pnpm dev` | Vite ready on `http://localhost:5173`, `Using secrets defined in .dev.vars` |
| `curl /api/health` | `200 {"status":"ok","providers":["apify","treg"]}` |
| sign in | `200` with a 64-hex session token |
| `POST /api/profiles/save`, `GET /api/profiles/list` | `200`; saved row returned and listed |
| `POST /api/profiles/delete` | `{"success":true}`; deleted row absent from the next list |
| `POST /api/leads/save`, `GET /api/leads/list` | `200`; `total: 1` |
| `POST /api/leads/delete` | `{"success":true}`; `total: 1` after deleting the second row |
| `PUT/GET/DELETE /api/account/credentials` (treg) | configured `true`, then cleared to `{provider:null,configured:false,validatedAt:null}` |
| `GET /api/admin/me` | `{"role":"admin","isAdmin":true}` |
| `CLOUDFLARE_ENV=preview pnpm build` + dry-run | D1 `linkedin-insights-pro-preview`, cron and observability present |
| `CLOUDFLARE_ENV=production pnpm build` + dry-run | D1 `linkedin-insights-pro`, cron and observability present |
| `pnpm bench:limits` | all counts below Free limits (table above) |

Bundle inspection after `pnpm build` (`dist/linkedin_insights_pro/index.js`,
387,503 bytes; 378.42 KiB / 73.99 KiB gzip in the deploy dry-run):

- Node-only database, scraping-SDK, and proxy packages: absent.
- Shared server provider tokens: absent. Only per-User credentials exist.
- `TREG_TOKEN`: only the `TREG_TOKEN_PATTERN` regex constant; no token value.
- `CREDENTIAL_ENCRYPTION_KEY`: one reference, `env.CREDENTIAL_ENCRYPTION_KEY`;
  no key value. The generated `Env` type contains only `DB`, `ASSETS`, and
  `CREDENTIAL_ENCRYPTION_KEY`; there is no provider-token binding.
- Generated config contains `triggers.crons = ["0 3 * * *"]` and
  `observability.enabled = true` for both targets.

### Human-gated steps not executed

No Cloudflare credentials were available, so none of the following was run or
is claimed:

1. `wrangler login` / API token setup.
2. Create the preview and production D1 databases and replace placeholder ids.
3. `wrangler secret put CREDENTIAL_ENCRYPTION_KEY` for preview and production.
4. Remote migrations and remote admin seeds.
5. Preview deploy, then preview smoke with real provider credentials:
   sign-in, Settings credential setup, Profile scrape, company Scrape Job,
   save/list/delete for profiles and leads, Admin.
6. Check cron execution and Workers Logs CPU time on preview.
7. Production secret, migrations, deploy, and smoke.

## 10. Production cutover and domain

**Status: not executed.** This section requires Cloudflare credentials, a
production domain, and real user-owned provider credentials. None were
available in this environment. The commands below are the exact sequence to
run; they are human-gated.

### 10.1 Preconditions

- `wrangler login` (or `CLOUDFLARE_API_TOKEN` with Workers and D1 permissions).
- A production domain whose DNS is managed in Cloudflare.
- The `pre-cloudflare` tag pushed to the remote before decommissioning:
  `git push origin pre-cloudflare`.
- A user-owned Apify or treg credential for the production smoke.
- No shared `APIFY_TOKEN`, `TREG_TOKEN`, database URL, or JWT secret exists in
  the Worker environment.

### 10.2 Databases and secrets

```bash
# Create real databases (once), then copy each id into wrangler.jsonc.
pnpm exec wrangler d1 create linkedin-insights-pro-preview
pnpm exec wrangler d1 create linkedin-insights-pro

# One independent key per environment.
pnpm exec wrangler secret put CREDENTIAL_ENCRYPTION_KEY --env preview --config wrangler.jsonc
pnpm exec wrangler secret put CREDENTIAL_ENCRYPTION_KEY --env production --config wrangler.jsonc
```

Replace the placeholder `database_id` values under `env.preview` and
`env.production` before deploying. Do not put the encryption key in `vars` or
in the repository.

### 10.3 Remote migrations and admin seed

```bash
pnpm exec wrangler d1 migrations apply DB --remote --env preview --config wrangler.jsonc
pnpm exec wrangler d1 migrations apply DB --remote --env production --config wrangler.jsonc

node scripts/create-admin-d1.mjs admin@example.com '<strong-password>' --remote --env preview
node scripts/create-admin-d1.mjs admin@example.com '<strong-password>' --remote --env production

pnpm exec wrangler d1 execute DB --remote --env production --command "SELECT 1" --config wrangler.jsonc
```

### 10.4 Preview deploy and smoke

```bash
pnpm deploy:preview
curl -sS https://linkedin-insights-pro-preview.<subdomain>.workers.dev/api/health
```

Run the smoke checklist in 10.7 against the preview URL with a real provider
credential. Check Workers Logs for CPU time and errors before promoting.

### 10.5 Production deploy

```bash
pnpm deploy:production
curl -sS https://linkedin-insights-pro-production.<subdomain>.workers.dev/api/health
```

### 10.6 Domain cutover

The custom domain is not committed in `wrangler.jsonc` because the production
hostname is deployment-specific. After the production smoke passes on the
workers.dev URL:

1. Open **Workers & Pages → linkedin-insights-pro-production → Settings →
   Domains & Routes**.
2. Add the production custom domain and let Cloudflare create the DNS record
   and certificate.
3. Verify `https://<domain>/api/health` and a deep link such as
   `https://<domain>/#/settings`.
4. Keep the old deployment and DNS reachable until the rollback window closes;
   point DNS back only if production smoke fails before decommissioning.

### 10.7 Production smoke checklist

Record each result with a real timestamp and the deployed version id.

| Step | Check | Expected |
| --- | --- | --- |
| 1 | `GET /api/health` | `200 {"status":"ok","providers":["apify","treg"]}` |
| 2 | Sign in as the seeded admin | `200` with `token` and `user` |
| 3 | `GET /api/auth/me` with the token | the same user |
| 4 | Settings: save an Apify or treg credential | status `configured: true`; token never returned |
| 5 | Profile scrape: 1–2 profile URLs | provider result array |
| 6 | Save one result; list profiles; delete it | row appears, then disappears |
| 7 | Company Scrape Job: start, poll to success, save a lead | job succeeds; lead appears in `GET /api/leads/list` |
| 8 | Delete the saved lead | `{"success":true}` and total decreases |
| 9 | Admin page: list users, toggle a setting | users load; setting persists |
| 10 | Workers Logs | no unhandled exceptions; CPU below Free p95 guidance |

Minimal API sequence (replace placeholders):

```bash
BASE=https://<production-domain>
curl -sS "$BASE/api/health"

TOKEN=$(curl -sS -X POST "$BASE/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"<password>"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token))")

curl -sS "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -sS -X PUT "$BASE/api/account/credentials" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"provider":"treg","token":"<user-owned-provider-key>"}'
curl -sS "$BASE/api/account/credentials" -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$BASE/api/scrape" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"urls":["https://www.linkedin.com/in/example/"],"tier":"full"}'

curl -sS -X POST "$BASE/api/scrape_company" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"companyUrl":"https://www.linkedin.com/company/example/","maxItems":5,"tier":"full"}'

# Poll with the returned job id until status is succeeded or failed.
curl -sS "$BASE/api/check_scrape_status?jobId=<job-id>" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$BASE/api/admin/me" -H "Authorization: Bearer $TOKEN"
```

Also complete the browser flow: sign-in, Settings credential, Profile scrape,
save/list/delete a profile, company Scrape Job, save/list/delete a lead, Admin.

### 10.8 Decommission the old stack

Only after the production smoke passes and DNS has been stable:

1. Delete the old deployment project.
2. Delete the old database and its secrets.
3. Remove old environment variables and tokens from CI and local shells.
4. Confirm no shared provider token exists in the Worker environment.

### 10.9 Cutover rollback decision

- If the production smoke fails before DNS cutover, keep the domain on the old
  stack and fix forward on preview.
- If it fails after cutover but before decommissioning, point DNS back to the
  old stack; D1 writes made in the meantime are not synced back.
- After decommissioning, only Worker version rollback remains: redeploy the
  last good commit or use `wrangler rollback`. The `pre-cloudflare` tag is code
  reference only.

## 11. Ticket 13 verification

Run in the cutover worktree with the lockfile updated after removing the legacy
scraping SDK, Postgres driver and typings, hosting CLI, dotenv, jsdom, and DOM
testing libraries:

| Command | Observed |
| --- | --- |
| `pnpm install --frozen-lockfile` | lockfile accepted; the removed packages are absent |
| `pnpm typecheck` | app and Worker type checks pass |
| `pnpm lint` | passes with zero warnings |
| `pnpm test --run` | 13 files, 154 tests pass |
| `pnpm build` | succeeds; 15 asset files in the deploy upload |
| `pnpm exec wrangler deploy --dry-run` | top-level `DB` binding; total upload 378.42 KiB / 73.99 KiB gzip |
| `CLOUDFLARE_ENV=production pnpm build` + `wrangler deploy --dry-run --env production` | production D1 `2222...` binding; same bundle |
| `git rev-parse pre-cloudflare` | `9b3b3698908d3f9fe198160931a073765d75b374` |

Bundle inspection after the production build:

- Node-only database, scraping-SDK, and proxy packages: absent.
- Shared server provider tokens: absent; `TREG_TOKEN` appears only as the
  `TREG_TOKEN_PATTERN` regex constant.
- `CREDENTIAL_ENCRYPTION_KEY`: one reference, `env.CREDENTIAL_ENCRYPTION_KEY`,
  with no key value; the generated `Env` type contains only `DB`, `ASSETS`, and
  `CREDENTIAL_ENCRYPTION_KEY`.
- The Vite plugin copies `.env.local` to
  `dist/linkedin_insights_pro/.dev.vars`; it contains only
  `VITE_GEMINI_API_KEY`. The `deploy` scripts delete `dist/*/.dev.vars` before
  Wrangler runs, and `dist/client/.assetsignore` excludes it from the asset
  upload.
- Generated config retains `assets`, the D1 binding, `triggers.crons =
  ["0 3 * * *"]`, and `observability.enabled = true` for both targets.

The forbidden-reference grep over tracked running code returns no matches for
the legacy hosting, Postgres, JWT-secret, provider-token, or scraping-SDK
identifiers. Remaining mentions are historical notes in `docs/adr/` and
`note.md`.

**Not executed:** every step in section 10 (Cloudflare login, remote database
creation, remote migrations, secret provisioning, preview/production deploys,
domain cutover, and the production smoke). No Cloudflare credentials or
production domain were available; nothing in this ticket claims a deploy.

