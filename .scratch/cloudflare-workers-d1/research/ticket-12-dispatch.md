# Ticket 12 dispatch note (Workers Free/Paid verification and hardening)

Branch `ticket/12-workers-free-paid-verification`. Requires 03, 08, 10, 11.

Files owned:
- `docs/deployment.md` (new): deployment path, secrets, D1 preview/prod
  separation, cron, benchmark methodology + measured table + Free/Paid
  decision, human-gated preview smoke checklist.
- `test/limits.test.ts` (new): invocation accounting (D1 queries and
  subrequests per endpoint) with a counting D1 proxy and stubbed fetch;
  parse-cost timings are recorded, not asserted tightly.
- `wrangler.jsonc`: add `env.preview` and `env.production` with distinct D1
  `database_name`/`database_id` placeholders; keep top-level defaults for
  tests/local. Do not add any provider token binding.
- `README.md` only if the deployment doc link belongs there (ticket 13 does
  the full rewrite; keep it minimal).
- `package.json` only if a `bench` script helps.

Measurements to record (methodology + numbers):
1. Auth CPU: PBKDF2-SHA512 10k/512-bit, 20 sign-ins through the Worker
   entry in workerd, median wall-clock. Compare with the 10 ms Free CPU limit.
2. Profile/company JSON parse cost: parse a profile fixture and a 100-item
   company dataset N times, median.
3. Subrequests per invocation for: sign-in, profile scrape (1 run start +
   poll + dataset), company job start (1), company job poll (1 + dataset on
   success), treg profile chunk (≤5), treg company poll (≤5).
4. D1 queries per invocation for: sign-in, profile list, leads list, leads
   batch delete, company job start/poll. Count `DB.prepare` calls via a Proxy
   passed as `env.DB` to `worker.fetch`.
Compare against Free: 10 ms CPU, 50 subrequests, 50 D1 queries per invocation.
Decision: Free if all measured values stay below; otherwise Paid with specific
reasons. Never weaken PBKDF2, credentials, or provider behavior to stay Free.

Hardening checklist:
- `CREDENTIAL_ENCRYPTION_KEY` is a Worker secret; document
  `wrangler secret put CREDENTIAL_ENCRYPTION_KEY` (no value in repo).
- Preview vs production D1 binding separation in wrangler config.
- Daily cron already configured by ticket 10; confirm in the generated
  deploy config.
- Observability enabled; bundle inspection: no `pg`, `apify-client`,
  `proxy-agent`; no APIFY_TOKEN/TREG_TOKEN in `Env` or bundle.
- Preview smoke checklist: sign-in, Settings credential, Profile scrape,
  company job, save, list, delete, Admin. Mark as human-gated because this
  environment has no Cloudflare credentials; do not claim it ran.
- Update AGENTS/README only where the deployment doc pointer is needed.
