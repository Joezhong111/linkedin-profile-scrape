# Start D1 empty instead of migrating legacy data

## Status

accepted — cutover completed

## Context

The migration replaces the previous Netlify Functions + Neon PostgreSQL stack
with a single Cloudflare Worker and D1. The existing Neon database holds no data
that must survive: accounts can sign up again, and saved rows are disposable.
Its table structure was still a useful starting point for the SQLite schema.

## Decision

Create fresh D1 databases and do not migrate legacy rows or sessions. Recreate
the domain structure (users, sessions, profiles, leads, Scrape Jobs, company
scrape history) in SQLite. Quotas and usage tables are not part of the new
domain (see ADR 0003) and were dropped rather than translated.

At cutover, remove the old deployment configuration, functions, dependencies,
and environment variables, leaving Cloudflare Workers + D1 as the only
deployment target and data layer. Preserve the last pre-migration commit as the
`pre-cloudflare` tag for code archaeology only; it is not a maintained second
deployment target, and recreating the old infrastructure is out of scope.

## Consequences

- Accounts do not carry over: users sign up or sign in again, and sessions
  start empty.
- No dual-write, reconciliation, or timestamp-normalization work is needed.
- There is no data rollback. Records written to D1 after cutover stay in D1;
  legacy rows are not migrated back automatically.
- Dead tables are dropped instead of translated.
- Rollback is a Worker version or commit rollback, not a parallel stack. The
  `pre-cloudflare` tag exists to inspect or reconstruct old code deliberately,
  not to promise a second live environment.

## Considered Options

- Migrate Neon rows into D1: rejected because the data has no retention value
  and a one-off import would keep the old stack alive through cutover.
- Keep both stacks deployable indefinitely: rejected because it leaves two
  data layers, two auth stories, and two sets of secrets to maintain.
