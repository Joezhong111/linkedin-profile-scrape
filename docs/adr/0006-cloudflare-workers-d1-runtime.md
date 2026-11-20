# Run everything on one Cloudflare Worker with D1

## Status

accepted — shipped

## Context

The application previously split the React SPA, API functions, and a managed
PostgreSQL database across separate platforms. The product needs one deployment
target, per-user provider credentials, and low operational cost. Cloudflare
Workers can serve static assets, handle API requests, run scheduled jobs, and
bind D1 in one deployable unit.

## Decision

- **One Worker, one config**: `worker/index.ts` is the only runtime. It serves
  `/api/*` through `worker/router.ts` and everything else through the `ASSETS`
  binding. Static output comes from the Vite build through
  `@cloudflare/vite-plugin`.
- **D1 as the only database**: the `DB` binding is a D1 database accessed with
  Drizzle ORM's `sqlite-core` dialect (`drizzle-orm/d1`). There is no Postgres,
  connection pool, or Hyperdrive.
- **No Node compatibility**: `compatibility_flags` explicitly disable Node.js
  compatibility (`no_nodejs_compat`, `no_nodejs_compat_v2`). Worker and shared
  code use Web APIs (`fetch`, `crypto.subtle`, `TextEncoder`), so a Node-only
  import fails at build or test time instead of shipping a broken bundle.
- **Secrets**: `CREDENTIAL_ENCRYPTION_KEY` is a Worker secret set with
  `wrangler secret put`; it is never a `vars` entry. User Scrape Credentials
  are encrypted with AES-GCM and stored in D1, not configured in the
  environment.
- **One migration ledger**: `db/schema.ts` generates SQL into `drizzle-d1/`,
  and `wrangler.jsonc` sets `migrations_dir` to that directory for every
  environment. Applied migrations are immutable; changes generate a new file.
- **Environment separation**: the top-level config covers local tests and
  `pnpm dev`; `env.preview` and `env.production` declare their own Worker name
  and D1 binding. The build must run with `CLOUDFLARE_ENV` so the generated
  deploy config carries the intended database.
- **Cron and observability**: a daily `0 3 * * *` Cron Trigger deletes Scrape
  Jobs older than seven days, and Workers Logs is enabled at the top level.
- **Free plan**: current D1, subrequest, and CPU measurements fit Workers Free;
  the measurement and decision are recorded in
  [docs/deployment.md](../deployment.md#8-workers-free-limits-measurement).

## Consequences

- Local tests run in workerd through `@cloudflare/vitest-plugin`, against a real
  local D1, so Workers-only behavior is exercised before deploy.
- D1 caps bound parameters at 100 per statement; helpers chunk `inArray` lists
  (see `chunk()` in `worker/db.ts`).
- Workers Free caps CPU, subrequests, and D1 queries per invocation; company
  scrapes are chunked and polling advances a job by at most five profiles.
- There is no long-lived connection; every request creates a Drizzle client over
  the D1 binding.
- Bundle inspection matters: dependencies that reach for Node built-ins
  (`pg`, proxies, Node HTTP) cannot be added without breaking the runtime.
- The generated deployment config is a build artifact; D1 CLI commands should
  pass `--config wrangler.jsonc` to select an environment binding reliably.

## Considered Options

- Cloudflare Pages plus Functions: rejected because the Worker already serves
  assets and `/api/*` from one config and one deployment.
- Postgres or Hyperdrive on Cloudflare: rejected because D1 fits the owner-
  scoped workload and removes a second service.
- Enabling Node compatibility: rejected because it hides accidental Node-only
  imports and grows the bundle.
- Queues or Workflows for company scrapes: rejected for now; chunked polling
  stays inside Free limits without extra infrastructure.
