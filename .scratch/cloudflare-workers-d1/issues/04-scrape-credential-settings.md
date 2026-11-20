# 04: Scrape Credential Settings

**What to build:** A User can open Settings, choose Apify or treg as the Active Provider, paste a Scrape Credential, see it saved as configured, replace or clear it, and understand provider-specific constraints. Scraping remains disabled until a credential is configured.

**Blocked by:** 03 — Session-token authentication.

**Status:** resolved

- [x] Account credential endpoints support reading status, upserting a provider and key, and clearing the credential.
- [x] Responses expose only the Active Provider, configured status, and validation timestamp; the key is never returned, previewed, or logged.
- [x] The Scrape Credential is encrypted at rest with AES-GCM-256 using a Worker secret; D1 stores ciphertext and IV only.
- [x] Apify credentials are validated on save against the Apify current-user endpoint with Bearer authentication; an invalid token is rejected and not stored.
- [x] A non-paying Apify plan produces a clear warning without blocking the save, because plan flags are not a reliable capability signal.
- [x] treg credentials receive a format check on save and are validated by the first scrape; provider `401` or `403` produces an actionable credential error.
- [x] Switching the Active Provider overwrites the stored credential; clearing it disables scraping.
- [x] Settings is reachable from the navigation and includes the provider selector, write-only key field, configured status, replace and clear controls.
- [x] Settings explains that Apify requires a paid plan for API runs, that treg Profile scrapes never return phone, and that treg email is optional and often missing.
- [x] Scrape entry points are disabled without a configured credential, and the old `VITE_APIFY_TOKEN` readiness warning is removed.
- [x] Tests cover encryption at rest, write-only responses, Apify validation, treg lazy validation, provider switching, missing credentials, and invalid credentials.
- [x] No production server-side Apify or treg token exists.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `ba2b61f`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. AES-GCM at rest, write-only responses, Apify save-time validation, treg lazy validation verified by tests.
