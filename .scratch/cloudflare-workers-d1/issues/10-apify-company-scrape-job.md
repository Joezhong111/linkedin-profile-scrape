# 10: Apify company Scrape Job

**What to build:** A User with an Apify Scrape Credential can start a company Scrape Job with filters, a Full or Full+email tier, and `maxItems` up to 100; watch progress, resume after reload, and save selected Leads.

**Blocked by:** 04 — Scrape Credential Settings; 06 — Saved Leads CRUD; 08 — Apify Profile scrape.

**Status:** resolved

- [x] `POST /api/scrape_company` creates an owner-scoped Scrape Job and returns a job identifier plus a running status instead of a provider run identifier.
- [x] The company form shows the Active Provider as read-only, offers Full and Full+email, enforces the 100-item cap, and validates Apify filter limits of at most 50 locations and 50 job titles.
- [x] The job status endpoint accepts a job identifier and returns pending, running, succeeded, or failed with progress and result count; succeeded responses include deduplicated items and statistics.
- [x] Each poll checks the Apify run once, handles all terminal and transitional statuses, and copies dataset items into Scrape Job Items on success.
- [x] Job and item access is owner-scoped; a job identifier belonging to another User never returns items.
- [x] The frontend persists the active job identifier locally, resumes polling after reload, and stops on success or failure.
- [x] A daily cleanup removes Scrape Jobs and Scrape Job Items older than seven days.
- [x] Selected items save as Saved Leads through the existing Leads path, and Company Scrape History records and displays the run.
- [x] Tests cover job creation, owner isolation, polling progression, Apify status handling, deduplication and truncation, item persistence, cleanup, resume, Saved Lead saving, and history.
- [x] The deployed bundle contains no `apify-client`; no server-side Apify token is used.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `06b25ec`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Owner-scoped company jobs, poll/resume, dedupe/truncate, cleanup cron, history and Saved Leads verified.
