# 01: Preview Worker foundation

**What to build:** An operator can deploy a preview Cloudflare Worker that serves the SPA and a safe readiness response, with the Worker handling `/api/*` and static assets handling everything else. Local development runs the SPA and Worker together, and an integration test runs inside the Workers runtime. Implement the corresponding decisions in the migration spec for this feature; Netlify production remains untouched.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A preview Worker serves the SPA and `GET /api/health` returns a generic readiness payload naming the supported providers, with no secret or token presence exposed.
- [x] Unknown `/api/*` paths return a `501` JSON response; non-API routes serve the SPA fallback without invoking the Worker.
- [x] Local development serves the SPA and Worker together on port 5173; the old `/api/health` and `/api/scrape` Vite middleware are removed.
- [x] `.dev.vars` and `.wrangler` are gitignored, `.dev.vars.example` is tracked, and provider credentials are not required for this ticket.
- [x] `nodejs_compat` and `nodejs_compat_v2` are explicitly disabled, and the deployed bundle contains no `pg`, `apify-client`, or `proxy-agent`.
- [x] Wrangler configuration declares the Worker entry, static assets with SPA fallback, `/api/*` first routing, a D1 binding, and observability; the Vite plugin path omits `assets.directory`.
- [x] Worker types are generated and typechecked, and the Cloudflare Workers Vitest harness runs a health integration test through the Worker HTTP entry.
- [ ] `wrangler deploy --dry-run` passes, the preview deployment serves the SPA and health endpoint, and the production Netlify deployment is unchanged. (dry-run passes; a live preview deploy is human-gated)
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `ed9af32`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Preview deployment and the production Netlify smoke are human-gated (no Cloudflare credentials in the agent environment). SPA + health + 501 + Worker test harness verified locally and via `wrangler deploy --dry-run`.
