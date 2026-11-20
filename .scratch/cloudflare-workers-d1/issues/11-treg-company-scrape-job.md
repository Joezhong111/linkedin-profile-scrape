# 11: treg company Scrape Job

**What to build:** A User with a treg Scrape Credential gets the same company Scrape Job experience: filters, Full or Full+email, `maxItems` up to 100, progress, reload resume, deduplicated results, and Saved Leads.

**Blocked by:** 09 — treg Profile scrape; 10 — Apify company Scrape Job.

**Status:** resolved

- [x] The treg company adapter calls the lead-search endpoint with the correct company, location, job-title, years-at-company, and years-of-experience parameters.
- [x] Lead search paginates at 25 rows per page, stops at the page cap, deduplicates by Profile URL, and truncates to `maxItems` after deduplication.
- [x] Each row is enriched with the Full or Full+email profile endpoint according to the selected tier; enrichment uses concurrency five and does not call the email endpoint after the full endpoint.
- [x] Filtering validates treg's limit of at most 70 locations and 70 job titles.
- [x] Each job poll advances at most five Profiles, reports progress, and writes completed Scrape Results into Scrape Job Items.
- [x] Job ownership, reload resume, seven-day cleanup, success and failure states, and the status response shape reuse the Scrape Job behavior from ticket 10.
- [x] Save normalization covers LeadShort plus enriched profile data: names, location, current position, company, tenure, job period, email when present, followers, connections, verified and premium flags. Phone remains empty.
- [x] Selected items save as Saved Leads and Company Scrape History records the run.
- [x] Tests use recorded treg search and enriched-profile fixtures to cover pagination, deduplication, truncation, tier mapping, five-item chunks, idempotency, provider errors, and normalization.
- [x] No server-side treg token is used.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `f74319f`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. treg paged search/dedupe/truncate, 5-per-poll enrichment, incremental items, stats/history verified.
