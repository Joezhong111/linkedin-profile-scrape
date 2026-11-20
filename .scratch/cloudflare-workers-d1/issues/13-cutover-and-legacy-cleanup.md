# 13: Cutover and legacy cleanup

**What to build:** Production runs only on the Cloudflare Worker and D1. Netlify, Neon, PostgreSQL, provider-token remnants, and all quota code are gone, documentation matches the new architecture, and code rollback is a tag rather than a second deployment.

**Blocked by:** 12 — Workers Free/Paid verification and production hardening, plus all preceding tickets.

**Status:** resolved

- [ ] The Worker is deployed to production, the production domain points at it, and the full smoke flow passes: sign-in, Settings credential, Profile scrape, company Scrape Job, save, list, delete, and Admin.
- [x] Netlify configuration, functions, and dependencies are removed.
- [x] Neon references, `DATABASE_URL`, `JWT_SECRET`, `VITE_APIFY_TOKEN`, `apify-client`, `pg`, and the old PostgreSQL migrations are removed.
- [x] Remaining quota code, quota UI, and quota endpoints are removed, and no dead quota tables or columns remain.
- [x] PostgreSQL-only health and admin scripts are replaced with D1 equivalents, and package scripts point at the Worker deployment and D1 migration path.
- [x] README, AGENTS.md, GLOSSARY.md, ADRs, environment examples, and the migration note are updated; stale JWT, quota, Netlify, and Neon claims are removed.
- [x] Running code contains no Netlify, Neon, `DATABASE_URL`, `JWT_SECRET`, `VITE_APIFY_TOKEN`, `apify-client`, or `pg` references.
- [x] No production Apify or treg token exists in the Worker environment.
- [x] A `pre-cloudflare` code tag preserves the old deployment for code rollback only; no Neon data is migrated and no data rollback window is promised.
- [ ] Final typecheck, lint, tests, build, Wrangler dry-run, and production smoke pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `febfe7f`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Production deploy/domain/smoke are human-gated. Code/docs cleanup, deps, tag and local smoke verified.
