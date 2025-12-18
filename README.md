# LinkedIn Insights Pro (Neon + Netlify + Custom Auth)

This app scrapes LinkedIn profiles with Apify, stores data in Neon PostgreSQL via Drizzle ORM, and uses custom JWT authentication (no Supabase). It runs static UI with Vite and all backend endpoints as Netlify Functions.

## Features

- 🔎 Scraping via Apify Actor (People/Profiles)
- 💾 Neon PostgreSQL + Drizzle ORM schema and migrations
- 🔐 Custom JWT Auth (users, sessions) + RBAC (user_roles)
- 📈 Per-user quotas for scraping (apify_quotas, apify_usage)
- 📊 Profile visualization (Career Timeline, Network Influence)
- ⚙️ Netlify Functions for all backend API endpoints

## Requirements

- Node.js 20.19+
- npm
- Netlify account (for hosting) and Apify account (for scraping)

## Environment Variables (.env.local)

```
# Server-side (not exposed to browser)
DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require"
APIFY_TOKEN=your_apify_token

# Auth
JWT_SECRET=your-strong-random-secret-min-32-chars
```

## First-time setup

1. Install deps

```
npm install
```

2. Generate and push DB schema to Neon

```
npm run db:generate
npx drizzle-kit push
```

3. Create an admin user

```
node scripts/create-admin.js admin@example.com your_password
```

## Development (with Functions)

Use Netlify Dev so that /api/\* routes are proxied to Functions:

```
npm run dev:netlify
# open http://localhost:8888
```

Note: plain `npm run dev` (Vite on 5173) only serves frontend and will return 404 for /api/\*.

## Build

```
npm run build
```

Outputs static files in dist/ and compiles client bundle. Functions are executed by Netlify at runtime (TS sources in netlify/functions).

## Deploy to Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node version: `20.19.0` (set in netlify.toml)
- Redirects: already configured in netlify.toml (SPA + API)
- Site environment variables:
  - DATABASE_URL
  - APIFY_TOKEN
  - JWT_SECRET

You can initialize or link your site:

```
# one-time
netlify init
# or link an existing site
netlify link
```

Then deploy from CI (recommended) or locally:

```
netlify deploy --build      # preview
netlify deploy --prod --build
```

## API Endpoints (Netlify Functions)

- Auth: POST /api/auth/signin, /api/auth/signup, /api/auth/signout, GET /api/auth/me
- Admin: GET /api/admin/me, GET/POST /api/admin/quotas, POST /api/admin/create-user, GET/POST /api/admin/toggles
- Profiles: GET /api/profiles/list, POST /api/profiles/save, POST /api/profiles/delete, POST /api/profiles/update-ai
- Misc: GET /api/health, POST /api/scrape

## Common issues

- Login stuck on /login
  - Use Netlify Dev (http://localhost:8888). Vite 5173 won’t proxy Functions.
  - Hard refresh (Shift+Reload). Ensure localStorage has `auth_token`.
- "Quota disabled"
  - Set user quota in Admin page, or call POST /api/admin/quotas with { user_id, daily_limit }.
- "APIFY token missing"
  - Set APIFY_TOKEN in .env.local (dev) and Netlify site env (prod). `/api/health` returns `{ apify: true }` when ok.
- DB connection errors
  - Check DATABASE_URL (Neon), ensure `?sslmode=require` and server reachable.

## Project structure (key files)

```
lib/
  auth.ts              # Frontend auth client (localStorage session)
  auth-server.ts       # Server-side helpers (hash/verify, sessions, roles)
db/
  schema.ts            # All tables: users, sessions, user_roles, apify_*, linkedin_profiles
  client.ts            # pg Pool + drizzle
etlify/functions/
  auth_*.ts            # Auth API
  admin_*.ts           # Admin API (quotas/toggles)
  profiles_*.ts        # Profiles API
  scrape.ts            # Apify scrape endpoint
services/
  auth.ts              # Auth wrapper for UI
  supabase.ts          # Profiles service (now talks to /api/*)
pages/
  Login.tsx, Dashboard.tsx, Profiles.tsx, Admin.tsx
```

## Security notes

- Never commit .env.local
- Use a strong JWT_SECRET in production (>= 32 chars)
- Rotate secrets periodically

## Legacy notes (Supabase)

The project previously used Supabase for auth and DB. It now uses Neon + custom auth. Legacy references were removed from code; any remaining mentions in docs refer to the old setup.

### Netlify

1. Connect your repository on Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add the same environment variables in Site settings → Build & deploy → Environment

The repo includes `netlify.toml` with SPA redirects and cache headers.

## Environment Variables

| Variable                    | Required | Description                                       |
| --------------------------- | -------- | ------------------------------------------------- |
| `APIFY_TOKEN`               | Yes      | Apify API token (used by Netlify Functions)       |
| `DATABASE_URL`              | Yes      | Supabase connection string for Drizzle migrations |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase service role key for admin functions     |
| `VITE_SUPABASE_URL`         | Yes      | Supabase project URL (exposed to frontend)        |
| `VITE_SUPABASE_ANON_KEY`    | Yes      | Supabase anonymous key (exposed to frontend)      |
| `VITE_GEMINI_API_KEY`       | No       | Google Gemini API key for AI analysis             |

## How to Get API Keys

### Apify

1. Go to https://apify.com
2. Sign up and log in
3. Navigate to Account → Integrations
4. Copy your API Token

### Supabase

1. Go to https://supabase.com
2. Create a new project
3. Go to Project Settings → API
4. Copy `Project URL` and `anon public` key

### Google Gemini

1. Go to https://ai.google.dev/
2. Click "Get API Key"
3. Create a new API key in Google Cloud Console

## Project Structure

```
├── App.tsx              # Main application component
├── index.tsx            # Entry point
├── components/
│   ├── dashboard/        # Talent Analytics Dashboard components
│   │   ├── CareerTimeline.tsx
│   │   ├── NetworkTreemap.tsx
│   │   ├── ProfileHeader.tsx
│   │   └── ...
│   ├── ProfileCard.tsx
│   └── ProfileRow.tsx
├── services/
│   ├── apify.ts        # LinkedIn scraping service
│   ├── supabase.ts     # Database service
│   └── gemini.ts       # AI analysis service
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration
└── .env.local          # Environment variables (create from .env.example)
```

## Security Notes

- **Never commit `.env.local`** - It contains sensitive API keys
- Use `.env.example` as a template for other developers
- Keep your API keys confidential
- Rotate keys regularly if compromised

## Troubleshooting

### "Environment variables are missing"

Make sure all required variables in `.env.local` are filled in correctly.

### "Supabase Connection Failed"

- Verify your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check that the `linkedin_profiles` table exists in your Supabase database
- Ensure RLS (Row Level Security) policies allow public access if needed

### "Apify Scraping Failed"

- Verify your `VITE_APIFY_TOKEN` is correct
- Check that you have sufficient Apify credits
- Ensure the LinkedIn URLs are valid and public

## License

MIT
