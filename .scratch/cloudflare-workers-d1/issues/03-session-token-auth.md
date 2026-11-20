# 03: Session-token authentication

**What to build:** A User can sign up, sign in, stay signed in across reloads, sign out, and reach an authenticated view. Sessions are opaque Session Tokens stored in D1, not JWTs. The default User role and the Admin role are available for later tickets.

**Blocked by:** 02 — D1 schema and migration-branch cutover.

**Status:** resolved

- [x] Sign-up, sign-in, sign-out, and current-User endpoints work against D1 and keep their existing request and response shapes.
- [x] Passwords use PBKDF2-SHA512 with 10,000 rounds, 64-byte output, and the `salt:hash` format through WebCrypto; existing hash verification semantics are preserved.
- [x] A Session Token is 32 random bytes as hex, stored server-side, expires after 30 days, and is deleted on sign-out.
- [x] Missing, invalid, or expired Session Tokens return `401`; a valid token resolves the current User.
- [x] The login and sign-up UI stores the Session Token locally, sends it as a Bearer token, redirects unauthenticated visitors to login, and keeps the User signed in after reload.
- [x] Every new User receives the default `user` role; the Admin role is readable and available to the Admin guard.
- [x] Contract tests cover sign-up, sign-in, sign-out, current User, missing token, invalid token, and expired token.
- [x] Authentication CPU is measured and recorded; if Workers Free's 10 ms CPU limit is exceeded, that is recorded as a Paid-plan requirement rather than weakening the password hash.
- [x] JWT terminology and `JWT_SECRET` do not appear in the auth path, environment examples, or comments.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `7e57c20`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Auth CPU median ~2 ms in workerd; legacy `salt:hash` vector verifies.
