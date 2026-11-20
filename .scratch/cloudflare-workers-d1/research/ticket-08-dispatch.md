# Ticket 08 dispatch note (Apify profile scrape)

Worktree: `/Users/zhongyihao/Dev/lps-worktrees/08-apify-profile-scrape`, branch
`ticket/08-apify-profile-scrape`.

Preconditions on the integration tip: `worker/credentials.ts` with
`getProviderToken` (ticket 04), `lib/normalize.ts` with `normalizeScrapeItem`
(ticket 05), `worker/routes/scrape.ts` does not exist yet.

Files owned:
- `worker/providers/types.ts` (new; exact interface from architecture)
- `worker/providers/apify.ts` (new)
- `worker/providers/index.ts` (new; `providerFor(user)` != treg yet)
- `worker/routes/scrape.ts` (new; profile only)
- `worker/routes/index.ts` (one import + spread)
- `services/apify.ts` (tier, jobId later; `mapApifyToLinkedInProfile` already
  delegates to normalize)
- `pages/Home.tsx` (provider read-only, 10-URL cap, fixed-Full label; keep the
  ticket-04 credential gate and the existing company form untouched apart from
  removing the tier values Short)
- `test/fixtures/apify-*.json`, `test/apify-profile.test.ts` (new)
- `test/helpers.ts` (append credential helper use only)
- no schema change

Apify adapter:
- `POST https://api.apify.com/v2/acts/2SyF0bVxmgGr8IVCZ/runs`, Bearer,
  `{ profileUrls }`, read `data.id/status/defaultDatasetId`.
- Poll `GET /actor-runs/{id}` every `pollDelayMs` (default 2000) until terminal
  or `maxWaitMs` (default 120000).
- Terminal success -> `GET /datasets/{id}/items?format=json&clean=true`, expect
  a bare array.
- `READY/RUNNING/TIMING-OUT/ABORTING` -> keep polling; `SUCCEEDED` -> done;
  `FAILED/ABORTED/TIMED-OUT` -> `ProviderError('provider')`; timeout ->
  `ProviderError('timeout')`; HTTP 401/403 -> `ProviderError('credential')`.
- Actor input stays `{ profileUrls }` (fixed Full; the actor attempts email and
  phone).

Route:
- `POST /api/scrape` body `{ urls, tier? }`.
- Validate array 1..10, each `linkedin.com/in/`; else 400.
- `getProviderToken` (401 session first, 400 missing/unreadable credential).
- `providerFor(user)` must be Apify in this ticket; treg user -> 400
  `credential_invalid`? No: ticket 09 adds treg. Until then, if
  `activeProvider === 'treg'`, return 502 `{error:'treg provider is not
  available yet'}`? Better: return 400 `{error:'Unsupported active provider'}`
  so it is honest, and ticket 09 replaces it.
- Return the provider's raw items as a bare array (no wrapping).
- Provider errors: credential -> 400 `credential_invalid`; timeout/provider ->
  502 readable. Never include the token; redact `token=...` from provider
  messages.

Frontend:
- The profile form must request at most 10 URLs and show the cap.
- Provider read-only label from credential status.
- For Apify, hide the profile tier selector and show "Fixed Full — attempts
  email and phone".
- Company tier select stays but Short is removed (values: `full`/`full_email`),
  even though company scraping lands in ticket 10; keep it compiling.
- `services/apify.ts`: `tier` fields; keep `mapApifyToLinkedInProfile`.

Tests:
- Request construction: canonical act-run URL, `Authorization: Bearer`, JSON
  body `{profileUrls}`.
- 10 cap: 11 URLs -> 400; non-profile URL -> 400; empty -> 400.
- Missing credential -> 400 `credential_missing`.
- Provider 401 -> 400 `credential_invalid`; provider 500 -> 502.
- Run transitions: READY+RUNNING+SUCCEEDED -> items; FAILED -> 502;
  TIMED-OUT -> 502. Pass `pollDelayMs: 0` by testing the adapter directly with
  `fetchMock` (and one HTTP-level test using a start response that is already
  SUCCEEDED).
- Dataset bare array; empty dataset -> [].
- Normalization + preview-to-save: scrape -> take item -> `/api/profiles/save`
  with `raw_data` -> list shows populated name/headline/location/email/
  followers/job/company and retained raw_data.
- No `apify-client` import anywhere.
