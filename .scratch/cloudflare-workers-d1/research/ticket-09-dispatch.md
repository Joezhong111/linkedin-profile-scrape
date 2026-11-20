# Ticket 09 dispatch note (treg profile scrape)

Worktree: `08` merged first. Branch `ticket/09-treg-profile-scrape`.

Preconditions on integration tip: `worker/providers/types.ts`, `apify.ts`,
`index.ts` (`providerFor`), `worker/routes/scrape.ts` (profile-only),
`worker/credentials.ts` (`getProviderToken`), `lib/normalize.ts`.

Files owned:
- `worker/providers/treg.ts` (new)
- `worker/providers/index.ts` (switch on `user.activeProvider`, both providers)
- `worker/routes/scrape.ts` (tier handling for treg)
- `services/apify.ts` (tier type already there)
- `pages/Home.tsx` (treg profile tier selector + phone/email/latency warnings)
- `test/fixtures/treg-*.json` (already copied by ticket 05 for profiles; add
  any error/envelope fixtures you need)
- `test/treg-profile.test.ts` (new)

treg adapter:
- Base `https://treg.to/call/{endpointId}`; GET with query params only, no body.
- Headers `X-Treg-Token`, `Idempotency-Key` (crypto.randomUUID per logical
  call). Reuse the same key on a retry.
- Envelope must be checked before use: `status` success/error, `error` null,
  `element` present for profile. HTTP 200 with `status:'error'` or missing
  `element` is a provider error.
- Tier mapping: `full` -> `harvestapi.linkedin.user.profile`,
  `full_email` -> `harvestapi.linkedin.user.profile.email`. Never call both
  for the same URL. The email endpoint already returns the full profile.
- Query: `url=<profile url>`.
- Concurrency cap 5 across URLs (`mapLimit`).
- 401/403 -> `ProviderError('credential')`; 429 -> read `Retry-After` seconds
  (default 1), retry once with the same idempotency key, then provider error;
  409/410/422 -> explicit `ProviderError('provider')` with the provider body
  (no retry loop). Timeout -> `ProviderError('timeout')`.
- No server token; token comes from `getProviderToken`.
- Missing email (`emails` absent/empty) is a valid profile result, not an
  error; phone stays empty.

Route:
- `/api/scrape` validates tier `full|full_email` (default full) for treg;
  Apify ignores tier and stays fixed Full.
- `providerFor` selects by user.activeProvider; no fallback.
- Response stays provider-shaped records (the treg `element`), bare array.

UI:
- When Active Provider is treg: show Full / Full+email selector for profiles,
  warn that Full+email may take around two minutes, warn treg never returns a
  phone number, warn treg email is optional and often missing.
- When Apify: keep the ticket-08 fixed-Full label and hidden selector.

Tests (fetchMock, no sleeps; pass a zero retry delay option if needed):
- Full -> `.profile` URL, Full+email -> `.profile.email` URL; GET, query
  params, `X-Treg-Token`, `Idempotency-Key` present.
- Envelope error with HTTP 200 -> 502 at HTTP layer.
- Missing email fixture -> 200 with profile, empty email.
- 401 -> 400 credential_invalid; 429 retries once then succeeds (count
  requests, same idempotency key); 409/410/422 -> explicit 502/400 handling.
- Concurrency cap: at most 5 in-flight requests (track with a counter in the
  mocked handler).
- HarvestAPI normalization on save: scrape -> `/api/profiles/save` -> columns
  populated (names, email array, follower/connection counts, experience,
  education, parsed location, current position, company LinkedIn URL,
  verified/premium), phone empty.
- No server treg token anywhere.
