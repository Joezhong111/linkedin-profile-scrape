# Provider adapter notes (Apify + treg)

Source of truth is the spec; this file records request/response shapes used by
the fixtures in `./fixtures/`.

## Apify REST (Bearer auth, no token in query strings)

Headers: `Authorization: Bearer <user token>`, `Content-Type: application/json`.
Base: `https://api.apify.com/v2`.

- Start run: `POST /acts/{actorId}/runs` body = actor input. Response
  `{ data: { id, status, defaultDatasetId, stats? } }`.
- Run status: `GET /actor-runs/{runId}`. Response `{ data: {...} }`.
- Dataset: `GET /datasets/{datasetId}/items?format=json&clean=true` returns a
  **bare JSON array**.
- Terminal statuses: `SUCCEEDED` (success), `FAILED`, `ABORTED`, `TIMED-OUT`.
  Transitional: `READY`, `RUNNING`; also treat `TIMING-OUT`, `ABORTING` as
  still-running until they become terminal.
- No log-line counting. Progress comes from `data.stats.itemsScraped` /
  `requestsFinished` when present, otherwise 0.

Actors:
- Profile: `2SyF0bVxmgGr8IVCZ` (dev_fusion), input `{ profileUrls: string[] }`.
  Fixed Full semantics: the actor attempts email and phone.
- Company: `Vb6LZkh4EqRlR0Ka9` (HarvestAPI), input:
```json
{
  "profileScraperMode": "Full ($8 per 1k)" | "Full + email search ($12 per 1k)",
  "maxItems": 1..100,
  "companies": ["https://www.linkedin.com/company/x"],
  "companyBatchMode": "all_at_once",
  "jobTitles": ["optional"],
  "locations": ["optional"],
  "yearsAtCurrentCompanyIds": ["1"],
  "yearsOfExperienceIds": ["2"]
}
```
Company start returns immediately; the app job stores `providerJobRef = run.id`.
On `SUCCEEDED`, copy dataset items into `scrape_job_items`, dedupe by
normalized `profile_url`, truncate to `maxItems`.

Filter limits: Apify max 50 locations and 50 job titles.

## treg direct call

Base: `https://treg.to/call/{endpointId}`. **GET only, query params, no body.**
Headers: `X-Treg-Token: <user token>`, `Idempotency-Key: <uuid per logical call>`.
Response envelope is checked before use:
`status` (success/error), `error`, and `element` / `elements` presence.
HTTP 200 is not success by itself.

Endpoints:
- `harvestapi.linkedin.user.profile` — `full` profile. Query: `url=<profile url>`.
- `harvestapi.linkedin.user.profile.email` — `full_email`; also returns the full
  profile plus email. Never call it after the full endpoint for the same person.
- `harvestapi.linkedin.leads.search` — lead search, 25 rows/page. Query params:
  `currentCompanies=<company url>`, `locations=<comma list>`, `currentJobTitles=<comma list>`,
  `yearsAtCurrentCompanyIds=<comma list>`, `yearsOfExperienceIds=<comma list>`,
  `page=<n>`. Optional `maxItems` must NOT be sent (server truncates client-side
  after dedupe).
- Response: `{ status, error, elements: [...], pagination: { pageNumber, totalPages, ... } }`.

Profile response: `{ status, error, element: {...} }`.
- Missing email: `element.emails` absent/empty; this is a valid result, not an
  error. Surface the profile with an empty email.
- `401`/`403` (HTTP or envelope) → invalid credential (400 to the app client).
- `409`, `410`, `422`: treat as provider error with the provider body preserved
  (409/410 usually an idempotency replay/expired key, 422 invalid input).
- `429`: honor `Retry-After` seconds (default 1) then retry at most once. Do not
  busy-loop.
- Concurrency cap 5 for both profile calls and company enrichment.
- Company job: page the search at 25 rows until `maxItems` unique profile URLs
  are collected or `pagination.totalPages` is exhausted (hard page cap 10),
  dedupe by `profile_url`, truncate to `maxItems`, store candidates. Each poll
  enriches at most five candidates through the tier endpoint and persists each
  Scrape Result into `scrape_job_items`.

Filter limits: treg max 70 locations and 70 job titles.

## Error mapping (app boundary)

- No credential configured → HTTP 400 `{ error, code: "credential_missing" }`.
- Provider 401/403 or failed envelope auth → HTTP 400
  `{ error, code: "credential_invalid" }`.
- Any other provider failure → HTTP 502 `{ error }` with tokens redacted.
- Bad URL/tier/filter/count input → HTTP 400 `{ error }`.
