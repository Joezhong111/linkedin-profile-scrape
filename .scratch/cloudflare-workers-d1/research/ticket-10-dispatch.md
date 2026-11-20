# Ticket 10 dispatch note (Apify company Scrape Job)

Worktree: branch `ticket/10-apify-company-scrape-job`. Requires tickets 06 + 08
merged (Leads CRUD + Apify profile provider/routes).

Files owned:
- `worker/providers/types.ts` (extend `CompanyScrapeInput`/job methods if ticket
  08 did not already)
- `worker/providers/apify.ts` (company start + poll)
- `worker/providers/index.ts` (no change expected)
- `worker/jobs.ts` (new; create/advance/read/cleanup)
- `worker/routes/scrape.ts` (company start branch)
- `worker/routes/jobs.ts` (new; status endpoint)
- `worker/routes/index.ts` (one import + spread)
- `worker/index.ts` (wire `scheduled` to cleanup; no separate cron ticket)
- `wrangler.jsonc` (`triggers.crons: ["0 3 * * *"]`)
- `services/apify.ts` (jobId polling, tier, resume helpers)
- `pages/Home.tsx` (company form: provider read-only, tier Full/Full+email,
  maxItems 1..100, jobId polling + localStorage resume, stop on success/fail)
- `test/fixtures/apify-company-*.json`, `test/apify-company.test.ts`
- `test/helpers.ts` (append only)
- no schema change (jobs tables exist)

Behavior:
- `POST /api/scrape_company` body: `{companyUrl, maxItems, tier, jobTitles,
  locations, yearsAtCurrentCompanyIds, yearsOfExperienceIds}`.
- Validate: company URL `linkedin.com/company/`; maxItems 1..100 (default 25);
  tier `full|full_email`; Apify filter limits ≤50 locations and ≤50 job titles;
  else 400.
- Require user + credential (400 missing/invalid).
- Create `scrape_jobs` row: owner, provider `apify`, job_type
  `company`, input_snapshot JSON (validated input), status `running`,
  progress 0, result_count 0, created_at/started_at.
- Start Apify company run (`Vb6LZkh4EqRlR0Ka9`) with
  `profileScraperMode` mapped from tier (`Full ($8 per 1k)` /
  `Full + email search ($12 per 1k)`), `maxItems`, `companies:[companyUrl]`,
  `companyBatchMode:'all_at_once'`, optional filters. Store `provider_job_ref`.
- Return 202 `{jobId, status:'running', progress:0, resultCount:0}`.
- `GET /api/check_scrape_status?jobId=`: require user; load job by id AND
  owner (other owner -> 404, never items). If terminal already, return stored
  state. If running:
  - Apify: one `GET /actor-runs/{ref}`.
  - READY/RUNNING/TIMING-OUT/ABORTING -> update progress from
    `stats.itemsScraped` when present; status running.
  - SUCCEEDED -> dataset items (bare array), normalize each to a Scrape Result
    (`normalizeScrapeItem` + `raw_data`), dedupe by `profile_url`, truncate to
    `maxItems`, write `scrape_job_items` in chunks, compute stats
    (`totalReturned`, `alreadyExists`, `newProfiles`, `duplicateRate` by
    querying saved leads for the owner), insert `company_scrape_history`
    (`maxItemsRequested`, `itemsReturned`, `itemsSaved = newProfiles`,
    `filtersUsed`), set status succeeded/progress/resultCount/completedAt.
  - FAILED/ABORTED/TIMED-OUT -> status failed + readable error_message; no
    partial items.
  - Provider 401/403 -> 400 credential_invalid (do not mark the job failed).
- Succeeded response: `{status:'succeeded', progress, resultCount, items,
  stats}`. Running: `{status:'running', progress, resultCount}`. Failed:
  `{status:'failed', progress, resultCount, error}`.
- Cleanup: `worker.scheduled()` deletes `scrape_jobs` with `created_at` older
  than 7 days (items cascade). Company history is retained.
- Frontend: company form as above; persist active jobId under a dedicated
  localStorage key per user, resume polling on mount (if the job is still
  running), clear on success/failure; `maxItems` cap 100; stop Short.

Tests:
- job creation returns jobId/status; provider start request shape (actor path,
  Bearer, input mapping, tier mapping); filter limit 400s; maxItems 101 -> 400.
- owner isolation: second user's jobId -> 404 and no items.
- poll progression: start -> READY -> RUNNING -> SUCCEEDED (mocked), items
  persisted exactly once, dedupe by profile_url, truncate to maxItems.
- statuses FAILED/ABORTED/TIMED-OUT -> failed; TIMING-OUT/ABORTING ->
  running.
- cleanup: old job + items deleted, fresh job retained, history retained.
- repeated polls after success return the same items, no duplicate rows.
- save selected item via `/api/leads/save` -> lead row populated, history
  row written once.
- no `apify-client` import; no server token.
