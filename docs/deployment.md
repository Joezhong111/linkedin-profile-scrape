# Cloudflare Workers + D1 deployment

This project runs as one Cloudflare Worker (`worker/index.ts`) that serves the
`/api/*` routes, the built SPA through the `ASSETS` binding, and a daily Cron
Trigger. Data lives in D1; there is no Postgres, `pg`, `apify-client`, or
`proxy-agent` in the Worker bundle. Provider tokens are supplied per User in
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
- **Application**: deploy the commit tagged `pre-cloudflare` to Netlify.
  This clone has no `pre-cloudflare` tag (`git tag --list` was empty), so
  creating and pushing that tag at the last Netlify/Postgres commit is a
  human release step before cutover.
- **Data**: there is no data rollback. D1 data written after cutover stays in
  D1; the legacy Postgres data is not migrated back automatically.

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
| Apify profile scrape (1 profile: start + poll + dataset) | 0 | 3 | — |
| `POST /api/scrape` (treg, 10 profiles) | 1 | 10 | provider concurrency 5 |
| `POST /api/scrape_company` (treg, 10 search pages) | 2 | 10 | page cap |
| `POST /api/scrape_company` (treg, 2-page fixture search) | 2 | 2 | — |
| `GET /api/check_scrape_status` (treg enrichment chunk) | 9 | 3 | 3 candidates; cap is 5 per poll |
| `JSON.parse` profile item (2,189 chars) | — | — | median 0.0020 ms/parse |
| `JSON.parse` 100-item company dataset (31,371 chars) | — | — | median 0.0180 ms/parse |

Maximum observed: **15 D1 queries** (30% of Free), **10 subrequests** (20% of
Free), and **2.00 ms** sign-in wall-clock (20% of the Free CPU budget), with
PBKDF2 itself also at 2.00 ms.

### Decision: Workers Free is sufficient

Reasons:

1. The highest D1 count is the 100-item Apify success poll at 15/50; ordinary
   reads are 2–4. Batching and chunk sizes stay well below D1's limits.
2. The highest subrequest count is 10/50 (treg's 10-URL and 10-page caps).
   Apify profile scraping is 3 and a company poll is at most 2.
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

- `apify-client`, `proxy-agent`, `pg`/`pg-native`, `APIFY_TOKEN`: absent.
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
