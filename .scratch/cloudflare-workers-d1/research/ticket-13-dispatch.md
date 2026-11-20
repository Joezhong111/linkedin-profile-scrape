# Ticket 13 dispatch note (cutover and legacy cleanup)

Branch `ticket/13-cutover-and-legacy-cleanup`. Requires 12 merged and all
preceding tickets.

Production deploy is human-gated in this environment (no Cloudflare
credentials). Do every code/config/doc change; record the exact deploy +
domain + smoke commands in `docs/deployment.md` and mark them not executed.

Files owned:
- `package.json` + lockfile: remove `apify-client`, `pg`, `@types/pg`,
  `netlify-cli`, `dotenv` (if unused), `jsdom`, `@testing-library/*` if truly
  unused by the Workers-runtime suite. Keep `@types/node` for configs/scripts.
- `.env.local` (gitignored): replace stale `DATABASE_URL`/`APIFY_TOKEN`/
  `JWT_SECRET` with only `VITE_GEMINI_API_KEY` if it existed; never commit it.
- `.env.example` (already trimmed), `.dev.vars.example` (already trimmed) —
  verify, do not regress.
- `README.md`: rewrite for Cloudflare Workers + D1 + BYOK. Sections:
  overview, stack, requirements (Node 20.19+, pnpm, Cloudflare account),
  setup, env/secrets table, commands, D1 migrations, admin seed, deploy,
  preview/prod D1, rollback (`pre-cloudflare` tag, no data rollback),
  project layout, troubleshooting. No Netlify/Neon/JWT/quota claims.
- `AGENTS.md`: replace build/dev/db/testing/env/architecture/deployment
  sections with the Worker/D1 reality. Keep agent skill sections.
- `GLOSSARY.md`: remove `usage`/`quotas` from Admin/User; keep the canonical
  domain terms; clarify Scrape Run vs Scrape Job.
- `docs/adr/0002-fresh-start-d1-cutover.md`: drop the stale "quotas" wording
  and Netlify-still-deployable wording; record the cutover outcome.
- `docs/adr/0003-byok-scraping-no-quotas.md`: verify it matches the shipped
  behavior; adjust if needed.
- `docs/adr/0006-cloudflare-workers-d1-runtime.md` (new): one page recording
  single Worker + assets, D1, drizzle sqlite, no Node compat, secret storage,
  migrations ledger, and the Free/Paid decision link.
- `note.md`: rewrite as a short migration record (what changed, phases merged,
  verification, rollback tag) and delete the obsolete phase prompts.
- `docs/deployment.md`: keep ticket 12's content; add the production deploy,
  domain cutover, and smoke checklist status.
- `scripts/create-admin-d1.mjs`: keep.
- `scripts/d1-health.mjs` or a `db:health` script: D1 equivalent of the old
  DB health check (`wrangler d1 execute DB --remote --command "SELECT 1"`).
- `App.tsx`: remove the stale Netlify comment.
- Any remaining netlify/Neon/JWT/quota references in running code.

Tag:
- `git tag pre-cloudflare 9b3b369` (the last commit on `main` before the
  migration branch). Do not move it; do not push (no remote configured).
  Verify `git rev-parse pre-cloudflare` resolves.

Verification:
- `grep -RIn "netlify\|DATABASE_URL\|JWT_SECRET\|VITE_APIFY_TOKEN\|apify-client\|from 'pg'" --include=*.ts --include=*.tsx --include=*.json --include=*.md .`
  excluding `node_modules`, `dist`, `.scratch`, lockfile, `.git` — only
  historical mentions allowed in `docs/adr`/`note.md`/`pre-cloudflare` notes.
  Running code must have zero.
- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`,
  `pnpm test --run`, `pnpm build`, `pnpm exec wrangler deploy --dry-run`.
- Bundle inspection: no `pg`, `apify-client`, `proxy-agent`, no provider
  tokens, no `.dev.vars` copied into the deploy upload.
- Confirm `wrangler.jsonc` still has DB, assets, observability, cron, and
  preview/production env separation.
- Production smoke: document and mark not executed (no credentials).
