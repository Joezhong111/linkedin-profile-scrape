# Users bring their own scrape credentials; quotas are removed

## Status

accepted

## Context

Scraping was billed to the operator through a server-side Apify token. Monthly quotas existed to cap that exposure. The product now requires users to connect their own provider account so the operator does not pay for scrapes.

## Decision

Each user has one active scrape provider (Apify or treg) and one encrypted provider credential, configured on a Settings page. Scrapes use only the active user's credential; a missing or invalid credential disables scraping with a clear error. Remove monthly quotas, usage accounting, the admin quotas endpoint and UI, and server-side provider tokens from production. Admin users also bring their own credential.

## Consequences

- Provider spend moves to the user; the operator pays only for Workers and D1.
- Provider keys are bearer secrets: encrypted at rest with AES-GCM, never returned to the client, and never logged.
- Apify requires a paid plan to run the actors through the API; the UI must state this.
- No usage analytics or per-user caps remain; abuse protection must come from the provider or a separate rate limit.
- The quota tables, quota endpoints, and quota UI disappear rather than remaining as dead code.

## Considered Options

- Keep quotas: rejected because the operator no longer pays the provider.
- Per-provider credentials: rejected in favor of one active credential to reduce secret surface and UI.
- Server token default: rejected because it keeps operator spend.
