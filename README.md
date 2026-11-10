# LinkedIn Insights Pro

A LinkedIn people-data app: signed-in users scrape profiles and company
employees with their own provider credential, review the results, and save the
people they need.

The whole application runs as one Cloudflare Worker. The Worker serves the
React SPA through a static-assets binding, handles every `/api/*` route, and
stores data in a D1 (SQLite) database. There is no separate application server.

## Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Heroicons, Recharts
- **Runtime**: one Cloudflare Worker with a static-assets binding
- **Database**: Cloudflare D1 (SQLite) through Drizzle ORM (`sqlite-core`)
- **Auth**: opaque session tokens stored in D1; PBKDF2-SHA512 password hashes
- **Scraping**: Apify and treg, called over HTTPS from the Worker
- **Credentials**: bring-your-own-key, encrypted at rest with AES-GCM
- **AI summary**: Google Gemini, optional, called from the browser

## Requirements

- Node.js 20.19+
- pnpm 9+
- A Cloudflare account with Workers and D1 available (for deploys)
- An Apify or treg account for each user who scrapes; Apify requires a paid
  plan to run its actors through the API

## Quick start

```bash
git clone <your-repo-url>
cd linkedin-profile-scrape
pnpm install
```

### 1. Local secrets

Copy the Worker secret example and generate an encryption key:

```bash
cp .dev.vars.example .dev.vars
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# paste the value after CREDENTIAL_ENCRYPTION_KEY= in .dev.vars
```

`.dev.vars` is gitignored. Never reuse the local key in preview or production.

The optional browser-side Gemini key goes in `.env.local`:

```bash
cp .env.example .env.local
# set VITE_GEMINI_API_KEY
```

`.env.local` holds only `VITE_GEMINI_API_KEY`. Scrape credentials are not
environment variables; each user saves their own in Settings.

### 2. Local database

```bash
pnpm db:migrate:local
```

This applies `drizzle-d1/` to the local D1 database used by `pnpm dev`.

### 3. Admin seed

There is **no built-in default account or password**: D1 starts with an empty
`users` table, and nothing is seeded automatically. Create the first Admin
yourself:

```bash
pnpm create-admin admin@example.com 'a-strong-password'
```

For local development only, this repo's smoke flow uses:

| Field    | Local example value    |
| -------- | ---------------------- |
| Email    | `admin@example.com`    |
| Password | `local-admin-password` |

That account exists in your local D1 only after you run the command below with
those values. Never use it in preview or production, and never commit a real
password.

```bash
# Local example (matches the smoke flow; safe for localhost only)
pnpm create-admin admin@example.com 'local-admin-password'

# Your own local Admin
pnpm create-admin you@example.com 'a-strong-password'
```

Add `--remote` to seed a remote database and `--env preview|production` to
choose the environment binding. Remote commands are human-gated (see
[docs/deployment.md](docs/deployment.md)). Re-running the seed for an existing
email resets that User's password and keeps their role.

### 4. Run

```bash
pnpm dev
```

Open http://localhost:5173. Vite serves the SPA and the Cloudflare plugin runs
the Worker in workerd, so `/api/*` works with the same code path as production.

## Environment and secrets

| Name                        | Where                           | Required | Purpose                                                          |
| --------------------------- | ------------------------------- | -------- | ---------------------------------------------------------------- |
| `CREDENTIAL_ENCRYPTION_KEY` | `.dev.vars` / `wrangler secret` | Yes      | Base64 32-byte AES-GCM key that encrypts user Scrape Credentials |
| `VITE_GEMINI_API_KEY`       | `.env.local` (build-time)       | No       | Gemini key for the optional client-side AI summary               |

Provider tokens are **not** Worker secrets. Each user configures an Apify or
treg credential in Settings; the Worker encrypts it before storing it in D1
and never returns it to the browser. Production has no shared Apify or treg
token.

`.env.example` and `.dev.vars.example` are the source of truth for the two
variables above. Do not add provider tokens to either file.

## Commands

| Command                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `pnpm dev`               | SPA + Worker in workerd (port 5173)                          |
| `pnpm build`             | Production build with the top-level Wrangler config          |
| `pnpm typecheck`         | Type-check the app and the Worker                            |
| `pnpm lint`              | ESLint with zero warnings allowed                            |
| `pnpm lint:fix`          | ESLint with automatic fixes                                  |
| `pnpm format`            | Format with Prettier                                         |
| `pnpm test`              | Vitest (workerd runtime); use `pnpm test --run` for one pass |
| `pnpm db:generate`       | Generate a new D1 migration from `db/schema.ts`              |
| `pnpm db:migrate:local`  | Apply migrations to local D1                                 |
| `pnpm db:migrate`        | Apply migrations to the remote top-level D1 database         |
| `pnpm db:health`         | Run `SELECT 1` against the remote D1 database                |
| `pnpm db:smoke`          | Schema assertions against local D1                           |
| `pnpm create-admin`      | Seed an Admin User and role in D1                            |
| `pnpm bench:limits`      | Measure Workers Free D1/subrequest/CPU headroom              |
| `pnpm deploy`            | Build and deploy with the top-level Wrangler config          |
| `pnpm deploy:preview`    | Build with the preview D1 binding and deploy                 |
| `pnpm deploy:production` | Build with the production D1 binding and deploy              |

`pnpm deploy` targets the top-level configuration, whose database id is a
placeholder; use `deploy:preview` or `deploy:production` for real deployments.
All three commands remove a copied `.dev.vars` from the build output before
Wrangler uploads it.

## D1 migrations

Schema lives in `db/schema.ts` (Drizzle `sqlite-core`). Generated SQL and
snapshots live in `drizzle-d1/`; the Worker config points D1 at that directory.

```bash
# Change db/schema.ts, then generate SQL
pnpm db:generate

# Apply to local D1 (top-level config)
pnpm db:migrate:local

# Apply to a deployed environment (human-gated)
pnpm exec wrangler d1 migrations apply DB --remote --env preview --config wrangler.jsonc
pnpm exec wrangler d1 migrations apply DB --remote --env production --config wrangler.jsonc
```

Use one migration ledger: all environment databases apply the same
`drizzle-d1/` files in order. Never edit an applied migration; generate a new
one instead.

## Deploy

Preview and production are separate Workers with separate D1 databases.
`wrangler.jsonc` keeps the top-level config for local tests and `pnpm dev`, and
declares `env.preview` / `env.production` with their own D1 bindings.

```bash
# Verify the bundle without uploading
pnpm build
pnpm exec wrangler deploy --dry-run

CLOUDFLARE_ENV=preview pnpm build
pnpm exec wrangler deploy --dry-run --env preview

CLOUDFLARE_ENV=production pnpm build
pnpm exec wrangler deploy --dry-run --env production
```

The full sequence — creating D1 databases, replacing placeholder ids, setting
`CREDENTIAL_ENCRYPTION_KEY`, applying remote migrations, seeding admins,
deploying, pointing the domain, and running the smoke checklist — is in
[docs/deployment.md](docs/deployment.md). Those steps require Cloudflare
credentials and are deliberately manual.

## Rollback

- **Worker**: redeploy the last known-good commit, or roll back a Worker
  version with `pnpm exec wrangler rollback --env production --config wrangler.jsonc`.
- **Code reference**: the `pre-cloudflare` tag marks the last commit before the
  Worker/D1 migration. It is a code-archaeology marker, not a supported
  second deployment target.
- **Data**: there is no data rollback. Records written to D1 after cutover stay
  in D1; the old database rows are not imported or exported by this project.

## Project layout

```text
linkedin-profile-scrape/
├── worker/                 # Cloudflare Worker
│   ├── index.ts            # fetch/scheduled entry; routes /api/* and assets
│   ├── router.ts           # route table and path matching
│   ├── routes/             # auth, profiles, leads, scrape, jobs, admin, credentials
│   ├── providers/          # Apify and treg REST adapters
│   ├── auth.ts             # session tokens and password hashing
│   ├── credentials.ts      # AES-GCM credential encryption
│   ├── jobs.ts             # Scrape Job polling and 7-day cleanup
│   └── db.ts               # Drizzle client over the D1 binding
├── db/schema.ts            # D1 schema (Drizzle sqlite-core)
├── drizzle-d1/             # Generated migrations and snapshots
├── components/             # React components (dashboard, charts, shared UI)
├── pages/                  # Home, Profiles, Leads, Settings, Admin, Login
├── services/               # Browser API clients and Gemini integration
├── lib/                    # Auth client, validation, formatting helpers
├── scripts/                # create-admin-d1.mjs
├── test/                   # Vitest suites running inside workerd
├── docs/                   # deployment guide and ADRs
├── App.tsx                 # Root component and hash routing
├── wrangler.jsonc          # Worker, assets, D1, cron, environments
└── vite.config.ts          # Vite + Cloudflare plugin
```

## API overview

All routes are served by the Worker; there is no separate API host or proxy.

- **Auth**: `POST /api/auth/signup`, `POST /api/auth/signin`,
  `POST /api/auth/signout`, `GET /api/auth/me`
- **Account**: `GET|PUT|DELETE /api/account/credentials`
- **Profiles**: `GET /api/profiles/list`, `POST /api/profiles/save`,
  `POST /api/profiles/delete`, `POST /api/profiles/update-ai`
- **Leads**: `GET /api/leads/list`, `POST /api/leads/save`,
  `POST /api/leads/delete`, `POST /api/leads/batch-delete`
- **Scraping**: `POST /api/scrape` (profiles), `POST /api/scrape_company`
  (company Scrape Job), `GET /api/check_scrape_status`,
  `GET /api/check_company_history`
- **Admin**: `GET /api/admin/me`, `GET|POST /api/admin/toggles`,
  `GET /api/admin/users`, `POST /api/admin/create-user`,
  `PATCH|DELETE /api/admin/users`
- **Health**: `GET /api/health`

Responses and field names are unchanged from the pre-migration API where
possible so the SPA and saved URLs keep working.

## Data model

- `users` — accounts, password hash, active provider, encrypted credential
- `sessions` — opaque session tokens with expiry
- `user_roles` — `admin` / `user`
- `app_settings` — registration and OAuth toggles
- `linkedin_profiles` — Saved Profiles owned by a User
- `linkedin_leads` — Saved Leads owned by a User
- `scrape_jobs` — company Scrape Jobs (provider, status, owner)
- `scrape_job_items` — per-job results, deleted after 7 days
- `company_scrape_history` — lightweight company scrape history

Every saved record is owner-scoped. A job or row belonging to another user is
rejected; there is no cross-account read path.

## Troubleshooting

### Login redirects back to `/login`

- Clear the session token in the browser (`localStorage.clear()`) and sign in
  again.
- Check `GET /api/health`; it reports the Worker and provider list.
- Confirm `pnpm dev` is running the Cloudflare plugin, not a bare static server.

### `CREDENTIAL_ENCRYPTION_KEY` errors

- Local: `.dev.vars` must exist with a base64 32-byte key.
- Deployed: set it with `wrangler secret put CREDENTIAL_ENCRYPTION_KEY`.
- Changing the key makes existing Scrape Credentials undecryptable; users must
  re-enter them.

### Scraping is disabled

- Open Settings and save a valid Apify or treg credential, then select the
  provider.
- Apify requires a paid plan for API actor runs.
- treg email scrapes are slow and may not find an email; the UI warns first.

### D1 errors locally

- Run `pnpm db:migrate:local`.
- If local state is corrupt, stop `pnpm dev`, delete `.wrangler/state`, and
  reapply migrations.

### Build errors

- Run `pnpm install`; Node.js must be 20.19 or newer.
- `pnpm exec wrangler deploy --dry-run` must succeed before a real deploy.

## Security

- Never commit `.dev.vars`, `.env.local`, or real credentials.
- Scrape Credentials are encrypted with AES-GCM and never returned to the
  browser or written to logs.
- Session tokens are opaque, stored server-side, and expire after 30 days.
- All SQL goes through Drizzle with bound parameters.
- Admin routes check the role on every request.

## License

MIT
