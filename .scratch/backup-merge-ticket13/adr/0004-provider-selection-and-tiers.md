# Apify and treg are user-selectable providers with a shared Full / Full+email vocabulary

## Status

accepted

## Context

The app used Apify for both profile and company scraping. Treg offers direct HarvestAPI calls: cheaper for Full profiles, more expensive for email, and without a documented phone guarantee. Users now supply their own provider credential.

## Decision

Keep both providers. The user's active provider is chosen in Settings and scrapes never fall back to the other provider. Scrape UIs expose only Full and Full+email. Company scraping maps both tiers on both providers. Profile scraping with Apify is fixed Full because the actor always attempts email and phone; profile scraping with treg maps Full to `.profile` and Full+email to `.profile.email`. Short is removed.

## Consequences

- The same tier label means different work per provider; the UI must always show the active provider.
- Apify profile cannot honor "Full without email"; the tier selector is hidden there with an explanatory label.
- Treg email is slower and often misses; the UI warns before using it.
- No silent provider fallback avoids double billing and ambiguous results.

## Considered Options

- Treg only: rejected because it changes email and phone behavior and costs more for email.
- Per-mode provider split: rejected because users now choose the provider explicitly.
- Keep Short: rejected to keep the tier vocabulary small and honest.
