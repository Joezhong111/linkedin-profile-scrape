# treg Profile phone and email enrichment, with live provider envelopes

Status: ready-for-agent

## Problem Statement

A User whose Active Provider is treg gets a Profile or Lead with an email only on
the Full+email tier and never gets a phone number. The shared Saved Profile and
Saved Lead shapes already have a `mobile_number`, and Apify Full populates it;
treg silently leaves it empty. The UI therefore tells Users that treg "never
returns a phone", which makes treg look less capable than it is.

The treg adapter was also built against recorded envelopes that do not match the
live catalog responses: live HarvestAPI envelopes carry a numeric `status: 200`
instead of `status: "success"`, and the HarvestAPI email variant rejects a
request that omits `findEmail=true`. A live treg scrape therefore fails before
any data reaches the User, even though the recorded fixtures pass.

## Solution

Keep the existing Scrape Tier semantics and make treg satisfy them:

- Full returns the full Profile and attempts a phone lookup.
- Full+email returns the full Profile, the email, and attempts a phone lookup.
- Company Scrape Jobs attempt the same phone lookup for each enriched Lead.

The phone lookup uses the cheapest catalog provider, BlitzAPI, directly through
treg. It is best-effort: a miss, an outage, or a provider error leaves the
Profile or Lead intact and never fails the scrape. A found number is returned as
`mobileNumber` and normalized into the existing `mobile_number` column, so no
database migration is needed.

The adapter accepts both the live numeric provider envelope and the older
`"success"` envelope, and sends the required `findEmail=true` parameter when the
email variant is used. The UI copy changes from "never returns a phone" to a
best-effort phone warning that names the US coverage bias.

## User Stories

1. As a User, I want a treg Full Profile scrape to return a phone number when the catalog has one, so that I can contact the person without switching to Apify.
2. As a User, I want a treg Full+email Profile scrape to return both the email and a phone number when available, so that one scrape gives me both contact paths.
3. As a User, I want a phone miss to leave the rest of the Profile intact, so that a missing number does not cost me the profile I already paid for.
4. As a User, I want a phone provider outage or timeout to leave the rest of the Profile intact, so that a secondary lookup cannot turn a successful scrape into a failure.
5. As a User, I want to see the found phone in the scrape result preview, so that I can decide whether to save the person.
6. As a User, I want a saved Profile to keep its phone number, so that the number is still there after the scrape is gone.
7. As a User, I want a saved Lead to keep its phone number, so that company-sourced contacts are as useful as direct Profiles.
8. As a User, I want the phone field to remain optional, so that Profiles without a number are still valid results.
9. As a User, I want the Profiles and Leads lists to show the phone column when a number exists, so that I can scan contacts without opening each row.
10. As a User, I want Full+email on treg to keep using the HarvestAPI email endpoint, so that the tier continues to return a full Profile plus SMTP-checked email in one call.
11. As a User, I want Full+email to send the provider's required email parameter, so that the request is not rejected before reaching the provider.
12. As a User, I want a treg scrape to work against the live HarvestAPI envelope, so that the app does not depend on stale recorded fixtures.
13. As a User, I want a live non-2xx provider status inside an HTTP 200 response to fail clearly, so that an empty Profile is not silently treated as success.
14. As a User, I want a missing email to leave the phone lookup working, so that the two contact paths are independent.
15. As a User, I want the UI to say treg phone lookup is best-effort, so that I do not treat a missing number as an app failure.
16. As a User, I want the UI to say US direct and mobile coverage is strongest, so that I understand why non-US Profiles often miss.
17. As a User, I want the UI to stop claiming treg never returns a phone, so that the product description matches the result.
18. As a User, I want the Full and Full+email tier names to keep their existing meaning, so that switching from Apify does not silently change what I selected.
19. As a User, I want a phone lookup on a miss to cost no provider charge, so that broad scraping stays affordable.
20. As a User, I want the phone lookup to use the cheapest catalog provider, so that a found number costs the least the catalog offers.
21. As a User, I want a 10-URL Profile scrape to stay inside the Workers Free subrequest budget, so that the app keeps working on the current plan.
22. As a User, I want a company Scrape Job to stay inside the same subrequest budget while enriching a chunk, so that polling does not fail partway through.
23. As a User, I want existing provider errors, credentials errors, rate limits, and timeouts to keep their current messages, so that troubleshooting does not change.
24. As a User, I want the phone lookup to reuse the same Scrape Credential as the rest of the scrape, so that no second key is required.
25. As a User, I want no server-side treg token to be introduced, so that I remain the only payer for my Scrape Runs.
26. As a User, I want my Saved Profiles and Saved Leads to stay inside my Owner Scope, so that phone enrichment cannot leak records across Users.
27. As a maintainer, I want the provider adapter tests to cover the live numeric envelope, so that a fixture-shaped assumption cannot regress.
28. As a maintainer, I want the phone merge tested at the route boundary, so that the raw provider item and the normalized `mobile_number` are proven together.
29. As a maintainer, I want the email parameter tested in the request shape, so that a missing required parameter is caught without a live call.
30. As a maintainer, I want the subrequest count of the new two-call path measured, so that Workers Free headroom stays documented.

## Implementation Decisions

### Provider boundary

- The app continues to call catalog endpoints through the treg relay with the
  User's Scrape Credential in `X-Treg-Token`; no server-side token is added.
- Full maps to the HarvestAPI full-profile endpoint with the Profile URL as a
  query parameter.
- Full+email maps to the HarvestAPI profile-with-email endpoint and must also
  send `findEmail=true`; the two profile endpoints are never called together for
  the same Profile.
- Company discovery continues to use the HarvestAPI lead-search endpoint with
  the same filter and paging contract. No company-search behavior changes.
- Phone uses the direct BlitzAPI catalog endpoint, not the routed phone tool.
  BlitzAPI is the cheapest phone catalog entry at $0.000495 per hit and $0 on a
  miss; the routed tool can fall through to providers priced up to $0.90.
- The phone request is a POST with a JSON body containing the Profile URL under
  the provider's own field name. Profile and company-search calls remain GET
  requests with query parameters.
- Every logical provider call keeps one idempotency key and the existing single
  429 retry that reuses that key. The phone call uses the same helper, so it
  inherits the same timeout and error mapping.
- The phone lookup runs after the profile call, once per Profile URL, inside the
  existing concurrency limit of five. It is not run when the profile call has
  already failed.
- A phone hit is merged into the profile element as `mobileNumber`. A miss, a
  non-2xx response, a timeout, or an unreadable body is swallowed so that the
  profile result is returned unchanged.
- The phone lookup is not live-verified. No verification header or verification
  field is added.

### Envelope compatibility

- A provider envelope is successful when its status is `"success"`, a numeric
  2xx, or a numeric 2xx string, and its error field is null or absent.
- A non-2xx numeric status, an error string, a missing or non-object element, or
  a non-array elements list continues to produce a provider error with the
  existing user-safe 502 mapping.
- The live HarvestAPI envelope's extra fields (cost, payments, request id,
  retries, user, entity id, original query) are ignored.

### Normalization and persistence

- The shared normalizer already maps `mobileNumber`, `mobile_number`, and
  `phone` to the `mobile_number` field; the phone merge reuses that path.
- No schema change is needed: Saved Profiles and Saved Leads already have a
  `mobile_number` column, and both client shapes already expose it.
- The profile route's save merge and the lead route's write mapping keep working
  unchanged; they consume the normalized snake_case value.
- Company Scrape Job items keep the provider shape, as before. The client
  normalizes an item before saving it as a Saved Lead, so the merged
  `mobileNumber` reaches the lead payload.
- The email picker keeps its existing behavior: a valid `emails[]` entry wins,
  otherwise the first entry with an address is used. A single risky address is
  still returned rather than dropped.

### UI

- The treg Profile tier selector keeps Full and Full+email.
- The warning list on the scrape page replaces "never returns a phone" with a
  best-effort phone warning and a US coverage hint.
- The Settings provider description uses the same best-effort wording.
- Apify's existing "fixed Full — attempts email and phone" label is unchanged.

### Operational constraints

- A 10-URL Profile scrape makes two provider calls per URL (profile plus
  phone), so 20 subrequests. A company enrichment chunk of three candidates
  makes six subrequests; the five-candidate cap makes ten.
- The phone lookup's miss path is a provider charge of zero. The hit path costs
  $0.000495 at the current BlitzAPI rate.
- The measured catalog costs that informed the decision were $0.0032 per full
  profile, $0.01 per profile-with-email, $0.000495 per phone hit, and $0.05 per
  company search page.

## Testing Decisions

A good test asserts observable behavior at an existing seam: the HTTP response
body and status from the Worker, the persisted Profile or Lead row, or the raw
provider request shape. Tests must not assert private helper calls, internal
control flow, or exact fixture equality when the fixture is not the contract.
Live paid calls are not part of the suite; recorded provider payloads and
stubbed `fetch` responses stand in for them.

The seams, from highest to lowest:

1. **Worker route seam.** `worker.fetch` with a stubbed global `fetch` and a real
   local D1 binding. Used by the Profile and company tests and by the Workers
   Free limit measurements. This is the preferred seam because it covers the
   route, provider adapter, normalization, persistence, and Owner Scope in one
   request.
2. **Provider adapter seam.** Direct calls to the treg provider with a stubbed
   `fetch`, used where the route cannot express a provider-only concern such as
   concurrency, retries, or the phone call shape.
3. **Pure normalizer seam.** `normalizeScrapeItem` on recorded provider payloads,
   used to pin the field mapping without any network or database.

No new seam is introduced. The phone feature is tested through the existing
route and adapter seams, and the normalization change is covered by the existing
profile and lead persistence tests.

Prior art:

- `test/treg-profile.test.ts` already covers tier mapping, request shape,
  envelope errors, idempotency, 429 retry, concurrency, normalization, and Saved
  Profile persistence. Extend it with the numeric live envelope, the required
  email parameter, the phone request shape, the phone merge, phone failure
  tolerance, and phone persistence.
- `test/treg-company.test.ts` already covers search paging, chunked enrichment,
  failed enrichment, and Saved Lead persistence. Extend it with a phone hit on a
  company candidate and the Saved Lead `mobile_number` column.
- `test/limits.test.ts` already counts subrequests through the real Worker.
  Update the treg profile and company rows to include the phone call and keep
  the assertions below the Workers Free limit.
- `test/helpers.ts` and the recorded HarvestAPI fixtures remain the shared
  harness; no live network or live credential belongs in a committed test.

## Out of Scope

- Live phone verification, phone ownership checks, or any `phone_verified`
  field.
- Routed phone fallback, international phone coverage, or switching to a more
  expensive provider when BlitzAPI misses.
- Switching Full+email from HarvestAPI to the routed email finder.
- A separate phone tier, phone toggle, or per-User phone preference.
- Apify behavior, Apify actor modes, or Apify contact fields.
- Database migrations for phone, since the column already exists.
- Changes to Scrape Job retention, cleanup, or Owner Scope enforcement.
- Changes to billing, quotas, or provider-key connections in treg.
- Live provider smoke tests in CI.

## Further Notes

The working tree already contains this change and was verified with 161 passing
tests, typecheck, lint, and live treg calls for a Profile with a phone, a
Profile with an email, and a company Lead. This spec records the contract and the
reasoning so the next agent can extend or audit it without re-running paid
provider calls.

The live email result for the tested Profile was a risky personal address, while
an older recorded fixture contained a work address. That is provider data
quality, not a format mismatch; the email picker returns what the provider
returns. The phone lookup remains US-biased because the cheapest provider is
US-focused. Both limitations are intentional under the "cheapest provider"
decision and should be revisited only with an explicit product decision.
