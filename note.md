# Cloudflare Workers + D1 migration record

This file replaces the phased migration prompts that drove the cutover. The
project now ships one deployment target and one data layer: a Cloudflare Worker
serving the SPA and `/api/*`, backed by D1.

## Outcome

- **Runtime**: one Worker (`worker/index.ts`) with an `ASSETS` binding. Node
  compatibility is disabled; Worker code uses Web APIs only.
- **Data**: D1 via Drizzle `sqlite-core`. Schema in `db/schema.ts`, migrations
  in `drizzle-d1/`, one ledger for every environment.
- **Auth**: opaque Session Tokens stored in D1, 30-day expiry, PBKDF2-SHA512
  password hashes. No JWT and no client-trusted role claim.
- **Scraping**: Apify and treg adapters over `fetch`; profile scrapes are
  synchronous (max 10 URLs), company scrapes are chunked, owner-scoped Scrape
  Jobs polled through `/api/check_scrape_status`.
- **Credentials**: bring-your-own-key. Each User saves one encrypted Scrape
  Credential; the operator holds no provider token. Quotas, usage accounting,
  and their admin endpoints/UI do not exist.
- **Operations**: daily Cron Trigger deletes Scrape Jobs after seven days;
  Workers Logs is enabled. Preview and production are separate Workers and D1
  databases, configured in `wrangler.jsonc`.
- **Legacy stack**: the Netlify Functions, Neon PostgreSQL, Postgres
  migrations, and their dependencies and environment variables were removed at
  cutover. Their code remains available only through the `pre-cloudflare` tag.

## Phases delivered

| Ticket | Delivered |
| --- | --- |
| 01 | Preview Worker foundation, assets binding, health |
| 02 | D1 schema, SQLite Drizzle, migration directory |
| 03 | Opaque Session Token auth |
| 04 | Encrypted per-User Scrape Credentials in Settings |
| 05 | Saved Profiles CRUD |
| 06 | Saved Leads CRUD |
| 07 | Admin without quotas |
| 08 | Apify profile scraping over REST |
| 09 | treg profile scraping |
| 10 | Apify company Scrape Jobs |
| 11 | treg company Scrape Jobs |
| 12 | Workers Free/Paid measurement and preview/production hardening |
| 13 | Cutover, legacy cleanup, docs, rollback tag |

## Verification

The closeout gate is:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test --run
pnpm build
pnpm exec wrangler deploy --dry-run
CLOUDFLARE_ENV=production pnpm build
pnpm exec wrangler deploy --dry-run --env production
```

Ticket 13 ran the gate after the dependency and documentation changes; results
are recorded in `docs/deployment.md` section 11. Preview/production deployment,
domain cutover, remote migrations, secret provisioning, and the production
smoke require Cloudflare credentials and are human-gated; see
`docs/deployment.md` section 10.

## Rollback

`pre-cloudflare` points at `9b3b369`, the last commit on `main` before the
migration. It preserves old code for inspection only. There is no second live
deployment target and no data rollback: D1 rows written after cutover stay in
D1.

## References

- Specification: `.scratch/cloudflare-workers-d1/spec.md`
- Deployment, secrets, limits, and cutover: `docs/deployment.md`
- Runtime decision: `docs/adr/0006-cloudflare-workers-d1-runtime.md`
- Data cutover decision: `docs/adr/0002-fresh-start-d1-cutover.md`
- BYOK decision: `docs/adr/0003-byok-scraping-no-quotas.md`
