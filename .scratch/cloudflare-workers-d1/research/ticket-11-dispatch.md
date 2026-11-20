# Ticket 11 dispatch note (treg company Scrape Job)

Branch `ticket/11-treg-company-scrape-job`. Requires tickets 09 + 10 merged.

Files owned:
- `worker/providers/treg.ts` (add company search + enrichment)
- `worker/providers/types.ts` (only if 09 left hooks missing)
- `worker/jobs.ts` (treg candidate cursor/chunk advance)
- `worker/routes/scrape.ts` (treg company start path)
- `pages/Home.tsx` (treg filter limits + tier, keep jobId polling)
- `test/fixtures/treg-lead-search-page1.json`, `page2.json`,
  `treg-profile*.json` (already present), `test/treg-company.test.ts`
- no schema change

Search:
- `harvestapi.linkedin.leads.search`, GET query only, `X-Treg-Token`,
  `Idempotency-Key`.
- Query: `currentCompanies=<company url>`, `locations=<comma list>`,
  `currentJobTitles=<comma list>`, `yearsAtCurrentCompanyIds=<comma list>`,
  `yearsOfExperienceIds=<comma list>`, `page=1..`.
- 25 rows/page; stop at `min(10 pages, pagination.totalPages)` or when
  `maxItems` unique profile URLs are collected.
- Dedupe by normalized `profile_url`; truncate to `maxItems` after dedupe
  (never send `maxItems` to the provider).
- Filter limits: locations/jobTitles ≤70 each; else 400.
- Store candidates in the job's `input_snapshot` (`{ input, candidates }`);
  provider_job_ref stays null.

Job creation:
- Same validation + credential path as ticket 10; provider `treg`.
- Search runs in the request; create the job `running`, progress 0, result
  count 0, store candidates, return 202 `{jobId,status:'running',progress:0,
  resultCount:0}`.
- If the search itself returns 0 candidates, finish immediately as
  `succeeded` with 0 items? Prefer: keep status running with 0 candidates so
  the first poll returns succeeded with empty items and stats; either is
  acceptable if the status response is consistent. Document the choice.

Poll:
- Each call enriches at most five candidates (concurrency 5) through the tier
  endpoint (`full` -> `.profile`, `full_email` -> `.profile.email`, never
  both per person).
- Write each enriched Scrape Result to `scrape_job_items` as it completes
  (`idx` = candidate index), update progress/result count and the cursor in
  `input_snapshot`.
- When the cursor reaches the end: compute stats (`totalReturned`,
  `alreadyExists`, `newProfiles`, `duplicateRate`), insert
  `company_scrape_history`, status `succeeded`, completed_at.
- Provider error mid-chunk: mark the job failed with a readable message; no
  partial item rows beyond completed candidates (spec says failed jobs show a
  clear error and no partial saves; jobs items already written are not
  returned on failure).
- Owner scope identical to ticket 10.

Tier mapping for enrichment: `full` -> `harvestapi.linkedin.user.profile`,
`full_email` -> `harvestapi.linkedin.user.profile.email`.

UI:
- Company form shows treg's 70/70 filter limits (Apify 50/50), Full/Full+email,
  active provider read-only, jobId polling/resume unchanged.

Tests:
- search request shape/params per page; pagination stops at totalPages;
  dedupe across pages; truncation to maxItems after dedupe; no `maxItems`
  query param.
- tier mapping to profile endpoints; never calls `.email` and `.profile` for
  the same URL.
- one poll advances at most 5 candidates, writes items, progress updates,
  repeated polls do not duplicate.
- success returns items+stats+history once; failure state clear.
- idempotency header present on every treg call; provider 401 -> 400
  credential_invalid; 429 once-retry with same key.
- owner isolation, 7-day cleanup, reload/resume reuse ticket-10 behavior.
- save enriched item via `/api/leads/save` populates name/location/current
  position/company/tenure/job period/email/followers/connections/
  verified/premium; phone empty.

## Integration notes discovered from ticket 10

- `worker/jobs.ts` `advanceCompanyJob` currently calls
  `provider.pollCompanyJob(job.providerJobRef, input, token)` where `input` is
  `job.inputSnapshot` cast to `CompanyScrapeInput`, and `persistItems` deletes
  all `scrape_job_items` then rewrites them on success.
- For treg you need the whole job row and cursor state. Change the provider
  signature usage so `pollCompanyJob` receives the job (or `{ providerJobRef,
  inputSnapshot }`) and update the Apify implementation to read the ref from
  that object.
- Store treg candidates + cursor in `inputSnapshot` as
  `{ ...CompanyScrapeInput, candidates, cursor }`.
- On a treg `running` poll, APPEND newly enriched items with increasing `idx`
  and do not delete previously written rows; do not duplicate an `idx`.
  `jobStatusPayload` for running jobs stays progress-only; on success,
  `computeStats` must consider all persisted items.
- `persistItems` may remain for Apify (rewrite-on-success); add an append path
  for treg.
- `cleanupOldJobs`, owner scoping, status shapes, and history insert should be
  reused, not duplicated.
