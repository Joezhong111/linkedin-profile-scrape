# 08: Apify Profile scrape

**What to build:** A User with an Apify Scrape Credential can submit up to 10 Profile URLs, preview the results, and save selected Profiles. The Apify provider uses only the User's credential, never a server token.

**Blocked by:** 04 — Scrape Credential Settings; 05 — Saved Profiles CRUD.

**Status:** resolved

- [x] A provider boundary is introduced so Profile scraping can call the Active Provider through one interface.
- [x] The Apify Profile adapter uses the canonical actor-run endpoint with Bearer authentication, handles all terminal and transitional run states, reads dataset items as a bare array, and no longer counts log lines.
- [x] `POST /api/scrape` accepts Profile URLs, enforces the 10-URL cap, uses the User's credential, and returns a bare array of Scrape Results.
- [x] Missing or invalid credentials return `400`; provider failures return `502` with a readable message; there is no silent fallback to another provider.
- [x] The scrape page shows the Active Provider as read-only and hides the Profile tier selector, labelling the operation as fixed Full with an email and phone attempt.
- [x] Profile results are previewed, selectable, and saved through the Saved Profiles path.
- [x] Save normalization covers the Apify dev_fusion shape so names, headline, location, email, followers, current job, company, experience, and education fields are populated when supplied; raw data remains available.
- [x] Tests use recorded Apify Profile fixtures to cover request construction, the 10-URL cap, missing credentials, provider errors, run-status handling, preview-to-save, and normalization.
- [x] The deployed bundle contains no `apify-client`; no server-side Apify token is used.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `837a4d3`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Apify adapter request shape/statuses/dataset + 10-URL cap + preview-to-save verified; bundle has no `apify-client`.
