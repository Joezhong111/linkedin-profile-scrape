# 01: Live treg Profile envelopes and Full+email request contract

**What to build:** A User with a treg Scrape Credential can run a Full or
Full+email Profile scrape against live HarvestAPI responses. Full returns the
full Profile; Full+email returns the full Profile and an email when the provider
supplies one. The request carries the email endpoint's required parameter, and
the adapter treats both the live numeric provider status and the legacy
`"success"` status as success without hiding real provider errors.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A Full Profile scrape calls the full-profile endpoint once per Profile URL.
- [x] A Full+email Profile scrape calls the profile-with-email endpoint once per Profile URL and sends the required email parameter exactly once.
- [x] The two profile endpoints are never called together for the same Profile URL.
- [x] A provider envelope with a numeric 2xx status and no error is accepted as success, and the legacy `"success"` status remains accepted.
- [x] A numeric non-2xx status, a non-null error, a missing element, or a non-array elements list produces the existing user-safe provider error and a 502.
- [x] Full+email returns the email when the provider supplies one and still returns the Profile when the provider supplies no email.
- [x] Each logical call keeps one idempotency key; the existing 429 retry, 409/410/422 mapping, timeout, and credential-error behavior are unchanged.
- [x] Tests cover both tiers, the live-shaped numeric envelope, a non-2xx native status, a missing email, and the email request parameter.
- [x] Typecheck, lint, and the full test suite pass.

## Comments

Resolved on `integration/treg-profile-contact-enrichment` (ticket merge `cbe09d5`, final review merge `6c6aac6`). The adapter accepts `"success"`, numeric 2xx, and numeric-string 2xx envelopes; non-2xx native statuses, non-null errors, missing elements, and non-array element lists still map to the user-safe 502. Full+email sends `findEmail=true` exactly once, and the two profile endpoints are never called together. Added coverage for the live numeric envelope, an error field on a 2xx status, non-array elements, per-URL call counts, and the request parameter. Final gate: typecheck, lint, 178 tests, build.
