# treg profile scrapes enrich phone through BlitzAPI

## Status

accepted

## Context

The treg adapter called HarvestAPI's profile and email endpoints, which never
return a phone. The shared `LinkedInProfile` and Lead shapes already have
`mobile_number`, and Apify Full populates it. Live HarvestAPI envelopes also
return a numeric `status: 200`, and the email variant requires
`findEmail=true`; the adapter's older fixture-shaped assumptions rejected both.

## Decision

For both profile tiers and each company enrichment chunk, call
`blitzapi.people.phone.find` once per profile with `{person_linkedin_url}`.
BlitzAPI is the cheapest phone catalog entry: $0.000495 per hit and $0 on a
miss, against a routed waterfall that can fall through to providers up to
$0.90. Treat the call as best-effort: a miss or a provider failure leaves the
profile unchanged. Merge a hit as `mobileNumber`, which `normalizeScrapeItem`
already maps to `mobile_number`. Accept both `status: "success"` and HTTP-like
numeric statuses in envelopes, and send `findEmail=true` on the email variant.

## Consequences

- A treg profile scrape makes two provider calls per URL: a 10-URL batch uses
  20 subrequests, and a 5-candidate company poll uses at most 10.
- Buying the cheapest provider narrows coverage: BlitzAPI targets US direct and
  mobile numbers, so non-US profiles often miss.
- Phone lookups are found-only, not live-verified; the UI says the number is
  best-effort.
