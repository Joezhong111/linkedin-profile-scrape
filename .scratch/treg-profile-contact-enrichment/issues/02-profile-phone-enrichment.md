# 02: Best-effort phone on treg Profile scrapes

**What to build:** A User running a treg Profile scrape gets a phone number in
the Scrape Result when the cheapest catalog provider has one. Both Full and
Full+email attempt the lookup once per Profile. A hit appears in the preview and
in the Saved Profile; a miss, provider outage, or timeout leaves the Profile
untouched. The scrape page and Settings copy describe the lookup as
best-effort and name the US coverage bias.

**Blocked by:** 01 — Live treg Profile envelopes and Full+email request contract.

**Status:** resolved

- [x] Both Profile tiers make exactly one phone call per Profile, after the profile call succeeds.
- [x] The phone call uses the cheapest catalog provider directly, with the same Scrape Credential, a JSON body containing the Profile URL, and no routed fallback or verification header.
- [x] A found number is merged into the Scrape Result and normalized into the existing `mobile_number` field.
- [x] A phone miss, provider error, timeout, or unreadable response leaves the Scrape Result unchanged and the scrape still succeeds.
- [x] No phone call is made when the profile call itself fails.
- [x] The result preview shows the phone when present, and saving the Profile persists the phone in the Saved Profile.
- [x] No database migration is added; Saved Profiles already have the phone column.
- [x] A 10-URL Profile scrape makes at most 20 provider subrequests and keeps provider concurrency at five.
- [x] The scrape page and Settings no longer claim treg never returns a phone; both say best-effort and mention strongest US direct/mobile coverage.
- [x] Tests cover the phone request shape, a phone hit merged into the result, a phone failure that leaves the Profile intact, and phone persistence in the Saved Profile.
- [x] Typecheck, lint, and the full test suite pass.

## Comments

Resolved on `integration/treg-profile-contact-enrichment` (ticket merge `0302abf`, final review merge `6c6aac6`). Both tiers make one profile call plus one best-effort BlitzAPI phone call per URL; a hit merges as `mobileNumber` and normalizes to `mobile_number`, while a miss, provider error, timeout, or unreadable body leaves the result intact. A profile failure skips the phone call. The result preview and the Leads list show the phone; saving persists it without a migration. Scrape page and Settings copy say best-effort with strongest US direct/mobile coverage. A 10-URL scrape is measured at 20 subrequests with provider concurrency five. Final gate: typecheck, lint, 178 tests, build.
