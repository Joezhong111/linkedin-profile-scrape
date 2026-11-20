# 06: Saved Leads CRUD and pagination

**What to build:** A User can view, filter, paginate, save, and delete Saved Leads, including batch deletion. Owner Scope is enforced and the pagination total is a number.

**Blocked by:** 03 — Session-token authentication.

**Status:** resolved

- [x] The Leads list returns the paginated envelope with data, total, page, page size, total pages, and available filters.
- [x] `total` is a number, not a string, and the frontend pagination arithmetic works with it.
- [x] Filters for free text, company, location, job title, and has-email work and remain owner-scoped.
- [x] Saving a Lead by the same owner and Profile URL updates the existing Saved Lead instead of duplicating it.
- [x] Single delete and batch delete only affect the current User's Saved Leads.
- [x] Batch delete chunks identifiers so the total D1 bound-parameter count stays below 100, including the owner predicate.
- [x] The Leads page supports listing, filtering, pagination, single delete, and batch delete.
- [x] Tests cover the envelope and numeric total, filters, pagination boundaries, duplicate save, cross-User isolation, and a batch larger than 100 identifiers.
- [x] Seeded test data can demonstrate the page without requiring a scrape provider.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `10f89f1`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Numeric total, filters, duplicate save, >100-id chunked batch delete verified by tests.
