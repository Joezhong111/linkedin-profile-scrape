# 07: Admin without quotas

**What to build:** An Admin can manage Users, roles, passwords, deletions, and registration without any quota surface. Admin User views show whether a Scrape Credential is configured, but never the key.

**Blocked by:** 03 — Session-token authentication.

**Status:** resolved

- [x] Admin-only endpoints require the Admin role and return `403` for non-Admins.
- [x] An Admin can list Users, create a User with a role, reset a password, delete a User, and toggle registration.
- [x] Creating a User writes the User and role atomically and does not create a quota row.
- [x] The App Settings registration toggle updates a single settings row and cannot create duplicate rows.
- [x] Admin User responses include whether a Scrape Credential is configured and which Active Provider is set, but never the key or ciphertext.
- [x] The `admin_quotas` endpoint is removed, and quota columns, usage bars, and quota editing controls are removed from the Admin UI.
- [x] The Admin page retains User management, roles, password reset, deletion, and registration controls only.
- [x] Tests cover Admin authorization, User creation with role, registration toggle, credential-configured status, password reset, deletion, and the absence of the quota endpoint.
- [x] Typecheck, lint, tests, build, and Wrangler dry-run pass.

## Comments

Resolved on `feat/cloudflare-workers-d1` (merge `ab88f32`). Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. Admin API/UI quota-free; eight-field user response; singleton registration verified.
