# Cloudflare Workers + D1 architecture contract

Shared contract for every implementer ticket. Read the spec
`.scratch/cloudflare-workers-d1/spec.md` and your ticket first. This file only
records the decisions that must be identical across tickets.

Repo root during work: your own worktree. Absolute main checkout:
`/Users/zhongyihao/Dev/linkedin-profile-scrape`.

## Non-negotiables

- One Cloudflare Worker (SPA assets + `/api/*`) and D1. No Netlify, no Neon, no
  PostgreSQL, no `pg`, no `apify-client`, no `proxy-agent`, no `nodejs_compat`.
- No server-side Apify or treg token. Every scrape uses the current User's
  encrypted Scrape Credential. Do not add `APIFY_TOKEN` / `TREG_TOKEN` to
  `Env`.
- No JWT. Opaque session tokens in D1. No `JWT_SECRET`.
- No quotas, usage accounting, tags, lead positions, quota UI or endpoints.
- Owner Scope on every Saved Profile, Saved Lead, Scrape Job, history row.
- Provider credentials are never returned, previewed, logged, or put in error
  bodies.

## Directory layout (owned by tickets)

```
worker/
  index.ts            # default export { fetch, scheduled }; routes `/api/*`, 501 otherwise
  router.ts           # path/method dispatch over ROUTES
  http.ts             # json/text/parseJsonBody/requireUser/errors
  auth.ts             # PBKDF2 + session tokens + role helpers
  db.ts               # createDb(d1), AppDb, chunk()
  credentials.ts      # AES-GCM at rest + provider credential resolution/validation
  providers/
    types.ts          # ScrapeProvider interface + input/result types
    apify.ts
    treg.ts
    index.ts          # providerFor(user)
  normalize.ts        # re-export lib/normalize.ts (worker-name convenience)
  jobs.ts             # Scrape Job create/advance/read/cleanup
  routes/
    index.ts          # export const ROUTES: Route[] = [...healthRoutes, ...]
    health.ts
    auth.ts
    profiles.ts
    leads.ts
    admin.ts
    credentials.ts
    scrape.ts
    jobs.ts
lib/
  normalize.ts        # PURE. Shared by Worker and SPA. No env/DOM imports.
test/
  apply-migrations.ts # setup file
  helpers.ts
  fixtures/*.json
  *.test.ts
```

Route modules export `Route[]`, each route `{ method, path, handler }` with
handler `(ctx: RouteContext) => Promise<Response>` where
`RouteContext = { request: Request; env: Env; ctx: ExecutionContext; params: Record<string,string>; url: URL }`.
`worker/routes/index.ts` is the only file that composes modules; tickets add
exactly one import + one spread line. Later tickets MUST NOT edit another
domain's route module.

Ticket 01 currently hardcodes `ROUTES` in `worker/router.ts`. Ticket 03 moves
the composition into `worker/routes/index.ts` (router imports it) as part of the
auth slice; every later ticket adds one import + one spread there.

## API surface (exact)

| Method | Path | Success payload |
|---|---|---|
| GET | `/api/health` | `{ status: "ok", providers: ["apify","treg"] }` |
| POST | `/api/auth/signup` | `{ user: {id,email,fullName}, token, expiresAt }` |
| POST | `/api/auth/signin` | same |
| POST | `/api/auth/signout` | `{ success: true }` |
| GET | `/api/auth/me` | `{ user: {id,email,fullName} }` |
| GET | `/api/profiles/list` | bare array of client-shaped profiles |
| POST | `/api/profiles/save` | single client-shaped profile |
| POST | `/api/profiles/delete` | `{ success: true }` |
| POST | `/api/profiles/update-ai` | `{ success: true }` |
| GET | `/api/leads/list` | `{ data, total:number, page, pageSize, totalPages, filters:{companies,locations} }` |
| POST | `/api/leads/save` | single client-shaped lead |
| POST | `/api/leads/delete` | `{ success: true }` |
| POST | `/api/leads/batch-delete` | `{ deleted: number }` |
| GET | `/api/check_company_history?companyUrl=` | `{ hasHistory, lastScrape, totalScrapes }` |
| GET | `/api/admin/me` | `{ user_id, role, isAdmin }` |
| GET | `/api/admin/toggles` | `{ registration_open, google_oauth_open }` |
| POST | `/api/admin/toggles` | text `OK` |
| GET | `/api/admin/users` | array `{ user_id,email,full_name,role,created_at,last_login_at,has_credential,active_provider }` |
| POST | `/api/admin/create-user` | `{ user_id,email,role }` |
| PATCH | `/api/admin/users` | `{ message }`; body `{ user_id, password? , role? }` |
| DELETE | `/api/admin/users?user_id=` | `{ message }` |
| GET | `/api/account/credentials` | `{ provider, configured, validatedAt }` |
| PUT | `/api/account/credentials` | `{ provider, configured, validatedAt, warning? }` |
| DELETE | `/api/account/credentials` | `{ provider:null, configured:false, validatedAt:null }` |
| POST | `/api/scrape` | bare array of Scrape Results |
| POST | `/api/scrape_company` | `202` `{ jobId, status:"running", progress, resultCount }` |
| GET | `/api/check_scrape_status?jobId=` | `{ status, progress, resultCount, items?, stats?, error? }` |

Unknown `/api/*` → `501` `{ error: "Not implemented" }`. Non-API paths never
reach the Worker (asset layer + SPA fallback).

Client shape = snake_case keys matching `types.ts` `LinkedInProfile`
(`profile_url`, `full_name`, `raw_data`, `job_title`, ...). Scrape Results are
the same shape.

`POST /api/scrape` and Scrape Job `items` return provider-shaped records (the
raw Apify dataset item / treg profile element), exactly as before the migration;
the SPA preview normalizes them with `lib/normalize.ts`, and persistence
normalizes again from `raw_data`. Do not invent a new wire shape.

Job status values: `pending` | `running` | `succeeded` | `failed`.
Scrape tiers: `full` | `full_email` only. Request field `tier` on
`/api/scrape` and `/api/scrape_company`; default `full`.

Errors: JSON `{ "error": string, "code"?: string }` with actionable text.
Status mapping: missing/invalid credential `400` (`credential_missing`,
`credential_invalid`); bad input `400`; auth `401`; admin `403`; provider
failure `502`; unknown API `501`.

## Auth

- PBKDF2-SHA512, 10000 iterations, 512 bits, WebCrypto. Stored `salt:hash`
  (both hex). Salt = 16 random bytes hex. Verify with constant-time compare.
- Session token = 32 random bytes hex, `sessions.token`, 30-day expiry,
  deleted on sign-out. Missing/invalid/expired → 401.
- `users` row + `user_roles` row created with `db.batch()`; role defaults `user`.

## D1 schema (single source: `db/schema.ts`, sqlite-core)

Tables: `users`, `sessions`, `linkedin_profiles`, `linkedin_leads`,
`user_roles`, `app_settings`, `company_scrape_history`, `scrape_jobs`,
`scrape_job_items`.

- All ids are text UUIDs (`$defaultFn(() => crypto.randomUUID())`).
- All timestamps are text ISO strings (`$defaultFn(() => new Date().toISOString())`).
- Booleans are `integer({ mode: "boolean" })`; big numbers `integer({ mode: "number" })`;
  decimals `real`; JSON `text({ mode: "json" })`.
- Cascading FKs everywhere a parent owns rows. Unique `(owner_id, profile_url)`
  on both saved tables. `scrape_job_items` PK `(job_id, idx)`.
- `users`: `active_provider` (`apify`|`treg`, nullable), `scrape_credential_ciphertext`,
  `scrape_credential_iv`, `scrape_credential_validated_at`.
- `app_settings`: PK `id` fixed `'global'` + `check` constraint `id = 'global'`;
  upsert on every write so duplicates cannot recur.
- `scrape_jobs`: `id`, `owner_id`, `provider`, `provider_job_ref`, `job_type`,
  `input_snapshot` JSON, `status`, `progress`, `result_count`, `error_message`,
  `created_at`, `started_at`, `completed_at`.
- `scrape_job_items`: `job_id`, `idx`, `data` JSON, `created_at`.
- No quota, tag, or lead-position table/column.
- Migration ledger: `drizzle-d1/` generated by `pnpm db:generate`; applied only
  with `wrangler d1 migrations apply DB --local|--remote`. One ledger.

## Shared helpers (must exist before tickets 04+)

`worker/db.ts`:
```ts
export type AppDb = ReturnType<typeof createDb>;
export function createDb(d1: D1Database): AppDb; // drizzle(d1, { schema })
export function chunk<T>(items: T[], size?: number): T[][]; // default 90
```

`worker/auth.ts`:
```ts
hashPassword(password: string): Promise<string>
verifyPassword(password: string, stored: string): Promise<boolean>
newSessionToken(): string
createUser(db, { email, password, fullName, role? }): Promise<User>
createSession(db, userId): Promise<Session>
verifyToken(db, token): Promise<User | null>
deleteSession(db, token): Promise<void>
getUserRole(db, userId): Promise<"admin"|"user">
requireUser(ctx): Promise<User | Response>   // Response => already-401
requireAdmin(ctx): Promise<User | Response>  // Response => 401/403
```

`worker/http.ts`: `json(data, status=200)`, `text(body, status=200)`,
`error(status, message, code?)`, `parseJsonBody(request)`,
`extractToken(request)`, `methodNotAllowed()`.

`worker/credentials.ts`:
```ts
type ProviderId = "apify" | "treg";
encryptCredential(env, plaintext): Promise<{ ciphertext: string; iv: string }>
decryptCredential(env, ciphertext, iv): Promise<string>
getCredentialStatus(db, user): Promise<{ provider, configured, validatedAt }>
getProviderToken(env, db, user): Promise<{ provider: ProviderId; token: string } | Response> // Response = 400 error
saveCredential(env, db, userId, provider, token): Promise<...>
clearCredential(db, userId): Promise<void>
```
`CREDENTIAL_ENCRYPTION_KEY` is a base64 32-byte key. AES-GCM with a random
12-byte IV per save; D1 stores base64 ciphertext + base64 IV only.

`worker/mappers.ts` (created by ticket 05, reused by 06): `mapProfileRow(row)`
and `mapLeadRow(row)` return the exact snake_case client shape; every profile
and lead route uses them. Never include credential columns in any client shape.

`services/http.ts` (created by ticket 04, reused by 05/06/07): `readApiError(res)`
prefers a JSON `{ error }` body and falls back to `res.text()`. All client
services use it instead of duplicating `await res.text()`.

Fixture ownership: ticket 05 copies `apify-profile-item.json` and
`treg-profile*.json` into `test/fixtures/` and owns `test/normalize.test.ts`;
ticket 06 copies `harvestapi-lead.json`; tickets 08-11 add provider-specific
fixtures (run envelopes, search pages) and tests. Do not duplicate fixture files.

## Providers

`worker/providers/types.ts`:
```ts
export type ScrapeTier = "full" | "full_email";
export interface ProfileScrapeInput { urls: string[]; tier: ScrapeTier }
export interface CompanyScrapeInput {
  companyUrl: string; maxItems: number; tier: ScrapeTier;
  jobTitles: string[]; locations: string[];
  yearsAtCurrentCompanyIds: string[]; yearsOfExperienceIds: string[];
}
export interface ProviderRunState { status: "pending"|"running"|"succeeded"|"failed"; progress: number; resultCount: number; items?: unknown[]; error?: string }
export class ProviderError extends Error {
  kind: "credential" | "provider" | "timeout" | "input";
  status?: number; retryAfterMs?: number;
}
export interface ScrapeProvider {
  scrapeProfiles(input, token, options?: { pollDelayMs?: number; maxWaitMs?: number }): Promise<unknown[]>;
  createCompanyJob(input, token): Promise<{ providerJobRef?: string; candidates?: unknown[] }>;
  pollCompanyJob(job, input, token): Promise<ProviderRunState>;
}
```
Provider HTTP errors map to `ProviderError`: provider 401/403 → `credential`;
timeout → `timeout`; other failures → `provider`. Routes map `credential` →
400 `credential_invalid`, `timeout`/`provider` → 502 readable. The optional
`options` exists only so adapter tests can pass `pollDelayMs: 0` without
sleeping; routes use defaults (2000 ms, 120000 ms). No fallback between
providers.

- Apify base `https://api.apify.com/v2`, Bearer auth. Profile actor
  `2SyF0bVxmgGr8IVCZ` (input `{ profileUrls }`). Company actor
  `Vb6LZkh4EqRlR0Ka9` (`profileScraperMode` string:
  `Full ($8 per 1k)` / `Full + email search ($12 per 1k)`).
  Start `POST /acts/{id}/runs`, status `GET /actor-runs/{runId}`, dataset
  `GET /datasets/{id}/items?format=json&clean=true` (bare array).
  Statuses: READY/RUNNING → running; SUCCEEDED → succeeded;
  FAILED/ABORTED/TIMED-OUT/TIMING-OUT/ABORTING → failed.
- treg base `https://treg.to/call/{endpointId}`, header `X-Treg-Token`, GET
  query only, `Idempotency-Key` per logical call, no JSON body. Endpoints:
  `harvestapi.linkedin.user.profile` (full),
  `harvestapi.linkedin.user.profile.email` (full_email; returns full profile),
  `harvestapi.linkedin.leads.search` (25/page). Response envelope is checked
  for `status`, `error`, and `element`/`elements`. 409/410/422/429 handled
  explicitly. Concurrency cap 5.
- Filter limits: Apify ≤50 locations/jobTitles; treg ≤70. Company `maxItems`
  1..100. Profile URLs 1..10, all `linkedin.com/in/`.
- `maxItems` truncation happens after dedupe by normalized `profile_url`.

## Normalization

`lib/normalize.ts` must export:
```ts
export function normalizeScrapeItem(raw: any): LinkedInProfile; // snake_case client shape
export function mergeNormalized<T>(existing: T | undefined, incoming: T): T; // never null-out supplied values
```
Covers both dev_fusion/Apify profile and HarvestAPI lead/full-profile shapes:
names, headline, location, about, photos, email (string or `emails[]`),
mobile, followers (`followerCount`), connections (`connectionsCount`),
experience/education, current position, company fields/LinkedIn URL, parsed
location, job period/tenure, verified/premium, public identifier, urn.
First non-empty alias wins; missing aliases never null a supplied field.
`raw_data` is always retained. Phone stays empty for treg.

## Frontend

- `services/apify.ts` uses `jobId` + `{ status, progress, resultCount, items, stats, error }`
  and sends `tier`. Keep `mapApifyToLinkedInProfile` as a wrapper over
  `normalizeScrapeItem`.
- `services/account.ts`: `getCredentialStatus`, `saveCredential`, `clearCredential`.
- Settings page `pages/Settings.tsx`, hash route `#/settings`, Navbar entry.
- Home: provider read-only; credentials gate; 10-URL cap; tier rules; full_email
  latency warning; job polling persisted in `localStorage`, resume on mount.
- Admin/UserManager: users/roles/password/delete/registration only; show
  credential configured + provider; no quota columns or usage bars.
- Remove `VITE_APIFY_TOKEN`, `import.meta.env.VITE_APIFY_TOKEN`, and the
  health-driven Apify readiness indicator.
- Error parsing: prefer JSON `error`, fall back to text.

## Tests

- Vitest with `@cloudflare/vitest-plugin`, `worker.fetch` HTTP seam, local D1
  created only by applying `drizzle-d1` migrations in setup.
- Providers mocked with `vi.stubGlobal('fetch', vi.fn(...))` (the installed
  `@cloudflare/vitest-plugin@1.7.0` does NOT export `fetchMock`). Restore with
  `vi.unstubAllGlobals()` in `afterEach`. No live calls, no sleeps (pass a zero
  poll/retry delay option to adapters; prefer poll-once design).
- Fixtures under `test/fixtures/`; one file per provider shape. Prepared
  reference fixtures live in
  `.scratch/cloudflare-workers-d1/research/fixtures/`; copy the relevant ones
  into `test/fixtures/` and adjust URLs/ids to your assertions.
- Assert HTTP status/body, persisted rows via D1 SQL, owner isolation, job
  transitions, provider request URL/method/headers/body, and dedupe/truncation.
  Never assert source text or mock call echoes.
- `test/helpers.ts` (created by ticket 03, extended only by adding functions)
  must export:
  ```ts
  interface TestSession { id: string; email: string; password: string; token: string }
  function workerFetch(path: string, init?: RequestInit, token?: string): Promise<Response>
  function signUp(email?: string, password?: string): Promise<TestSession>
  function signIn(email: string, password: string): Promise<TestSession>
  function makeAdmin(session: TestSession): Promise<void> // direct D1 role update
  async function readJson<T>(res: Response): Promise<T>
  ```
  Helpers call the Worker HTTP entry; only admin promotion uses D1 directly.
- `CREDENTIAL_ENCRYPTION_KEY` for tests is set explicitly in
  `vitest.config.ts` `miniflare.bindings` (base64 32 bytes, deterministic in
  test code), not read from `.dev.vars`.


## Verification gate (every ticket)

```
pnpm typecheck        # tsc app + tsc worker
pnpm lint
pnpm test --run
pnpm build
pnpm exec wrangler deploy --dry-run   # after pnpm build
```

Do not weaken hashing, credentials, owner scope, or provider checks to pass.

## Git protocol for implementers

1. Work only in your assigned worktree/branch.
2. `git log --oneline -1 feat/cloudflare-workers-d1` sanity check; if your
   branch base differs, `git reset --hard feat/cloudflare-workers-d1`.
3. Commit in logical chunks with descriptive messages.
4. Before reporting: `git merge feat/cloudflare-workers-d1` (resolve
   conflicts in your branch), re-run the gate, and report the branch name +
   commit list + gate output summary.
