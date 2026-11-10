# Use opaque session tokens, not JWTs

## Status

accepted

## Context

The README, `AGENTS.md`, and schema comments described authentication as JWT-based, but the implementation issues a 32-byte random token, stores it in the `sessions` table, and resolves it to a user on every request. `JWT_SECRET` was never read by code.

## Decision

Keep opaque, server-side session tokens with a 30-day expiry and immediate sign-out revocation. Remove JWT terminology and `JWT_SECRET` from documentation, environment examples, and comments. Keep the existing PBKDF2-SHA512 password hash format (10,000 rounds, 64-byte output, `salt:hash`) so existing hashes remain valid.

## Consequences

- Every authenticated request performs an indexed session lookup plus a user lookup.
- Sign-out and revocation need no denylist.
- Sessions are not migrated to D1; users sign in again after the cutover.

## Considered Options

- Signed JWTs: rejected because revocation still requires server-side state, so it adds key management without removing the lookup.
- Hybrid JWT-plus-session: rejected as strictly more moving parts for no benefit.
