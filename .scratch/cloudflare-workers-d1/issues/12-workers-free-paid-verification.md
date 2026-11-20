# 12: Workers Free/Paid verification and production hardening

**What to build:** The team knows with evidence whether Workers Free is sufficient, and the production Worker is hardened for deployment. No security or feature is weakened just to stay on Free.

**Blocked by:** 03 — Session-token authentication; 08 — Apify Profile scrape; 10 — Apify company Scrape Job; 11 — treg company Scrape Job.

**Status:** resolved

- [x] Authentication CPU, Profile JSON parsing, company item JSON parsing, subrequest counts, and D1 queries per invocation are measured and recorded.
- [x] Measurements are compared with Workers Free limits: 10 ms CPU, 50 subrequests, and 50 D1 queries per invocation.
- [x] A documented decision records Workers Free or Workers Paid. If Paid is required, the reasons are specific and no password-hash, credential, or provider behavior was compromised.
- [ ] Production secrets for Scrape Credential encryption are provisioned, preview and production D1 bindings are separated, and the daily job-cleanup Cron Trigger is configured.
- [ ] Observability, bundle inspection, and a preview smoke of sign-in, credential setup, Profile scrape, company Scrape Job, save, list, and delete are complete.
- [x] The deployment and benchmark notes are updated in the project documentation.
- [x] The Worker bundle contains no `pg`, `apify-client`, or `proxy-agent`, and no production Apify or treg token is present.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `950147b`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Decision: Workers Free is sufficient at measured margins (auth ~2 ms, max 15/50 D1 queries, worst-case 26/50 subrequests); preview/prod deploy, secrets and fleet CPU checks remain human-gated.
