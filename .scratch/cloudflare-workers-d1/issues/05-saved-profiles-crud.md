# 05: Saved Profiles CRUD

**What to build:** A User can view, save, update the AI summary of, and delete Saved Profiles. Saving the same Profile URL updates the existing record instead of creating a duplicate, and Owner Scope is enforced on every operation.

**Blocked by:** 03 — Session-token authentication.

**Status:** resolved

- [x] The Profiles list returns a bare array of Saved Profiles owned by the current User.
- [x] Saving requires a Profile URL, writes normalized values first and retains raw provider data, and updates the existing owner/URL record on repeat saves.
- [x] Deleting a Saved Profile and updating its AI summary only affect records owned by the current User.
- [x] Attempting to read, delete, or update another User's Saved Profile does not reveal or modify it.
- [x] The Profiles page lists Saved Profiles and supports deletion; the save path accepts the normalized profile shape used by later scrape tickets.
- [x] Contract tests cover list, save, duplicate update, delete, AI summary update, `401`, and cross-User isolation.
- [x] Seeded test data can demonstrate the page without requiring a scrape provider.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `b3b5bee`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Profiles CRUD + both-shape normalization verified by tests; raw_data retained.
