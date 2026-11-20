# Start D1 empty instead of migrating Neon data

## Status

accepted

## Context

The migration replaces Netlify Functions plus Neon PostgreSQL with Cloudflare Workers plus D1. The existing Neon database has no data that must survive, while its table structure remains a useful starting point.

## Decision

Create a fresh D1 database and do not migrate Neon rows or sessions. Recreate the domain structure (users, sessions, profiles, leads, quotas, history) in SQLite; unused tables are reviewed separately. Netlify stays deployable as the rollback target until the Cloudflare version is merged to `main`; after merge, Netlify configuration and functions are removed.

## Consequences

- Accounts do not carry over: users sign up or sign in again, and sessions start empty.
- No dual-write, reconciliation, or timestamp-normalization work is needed.
- A rollback after users write to D1 loses those D1-era records; the rollback window is only safe before the new version accepts writes.
- Dead tables can be dropped instead of translated.
