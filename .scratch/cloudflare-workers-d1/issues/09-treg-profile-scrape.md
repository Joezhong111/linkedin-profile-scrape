# 09: treg Profile scrape

**What to build:** A User with a treg Scrape Credential can submit up to 10 Profile URLs, choose Full or Full+email, preview results, and save selected Profiles. The UI explains that treg never returns phone and that email is optional and often missing.

**Blocked by:** 08 — Apify Profile scrape.

**Status:** resolved

- [x] The treg provider calls the direct catalog endpoint with the treg token header, GET query parameters only, no JSON body, and provider-verbatim response handling.
- [x] Profile Full maps to the full-profile endpoint and Full+email maps to the full-profile-with-email endpoint; the two are never called together for the same Profile.
- [x] Provider responses are checked for status, error, and element presence; HTTP 200 alone is not treated as success.
- [x] Short is not offered anywhere; Profile tiers are Full and Full+email only.
- [x] The scrape page shows the treg Profile tier selector and the phone and email warnings when treg is the Active Provider.
- [x] Profile calls use concurrency five, an idempotency key per logical call, explicit handling for `409`, `410`, and `422`, and retry-delay handling for `429`.
- [x] Save normalization covers the HarvestAPI profile shape: names, email array, follower and connection counts, experience, education, parsed location, current position, company LinkedIn URL, verified and premium flags. Phone remains empty.
- [x] Tests use recorded treg Profile and Profile-email fixtures to cover tier mapping, request shape, missing email, provider errors, idempotency, and normalization.
- [x] No server-side treg token is used.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `16a7eae`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. treg GET-only envelope/tier/idempotency/429/concurrency verified; no server treg token.
