# 03: Best-effort phone on company Scrape Jobs and Saved Leads

**What to build:** A User running a company Scrape Job gets a phone number on
each enriched Lead when the cheapest catalog provider has one. The phone lookup
reuses the Profile phone behavior and is best-effort: a miss or provider failure
never fails the Scrape Job or drops the Lead. Saving a Lead persists the number
in the Saved Lead. The subrequest counts and deployment notes reflect the extra
call.

**Blocked by:** 02 — Best-effort phone on treg Profile scrapes.

**Status:** resolved

- [x] Each candidate enriched by a company Scrape Job makes exactly one phone call, for both Full and Full+email.
- [x] A found number is merged into the stored item and normalized into the existing `mobile_number` field.
- [x] A phone miss, provider error, or timeout leaves the item unchanged and does not fail the Scrape Job.
- [x] No phone call is made when the candidate's profile call fails.
- [x] A succeeded Scrape Job does not repeat phone calls or re-persist items on a later poll.
- [x] Saving a Lead persists the phone in the Saved Lead without a schema migration.
- [x] A three-candidate enrichment chunk makes six subrequests, and a five-candidate chunk stays at ten; both remain under the Workers Free limit.
- [x] The deployment notes and the phone decision record state the two-call path, the cheapest-provider choice, and the US coverage tradeoff.
- [x] Tests cover a phone hit on a company candidate, Saved Lead persistence, phone failure tolerance, and the chunk subrequest count.
- [x] Typecheck, lint, and the full test suite pass.

## Comments

Resolved on `integration/treg-profile-contact-enrichment` (ticket merge `c93e221`, final review merge `6c6aac6`). Each enriched candidate makes one profile call plus one best-effort phone call for both tiers; misses, provider errors, and timeouts leave the item and job intact, and a failed profile call skips the phone lookup. A succeeded job makes no further calls on repeat polls. Saving a Lead persists `mobile_number` without a migration. Measured: a three-candidate chunk uses 6 subrequests, a five-candidate chunk 10, both under Workers Free limits. Deployment notes and ADR 0007 record the two-call path, the cheapest-provider choice, and the US coverage tradeoff. Final gate: typecheck, lint, 178 tests, build.
