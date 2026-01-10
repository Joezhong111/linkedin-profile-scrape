# LinkedIn Insights Pro

A LinkedIn profile scraping and analytics application built with React, Vite, Netlify Functions, Neon PostgreSQL, and Drizzle ORM.

## Features

- 🔎 **LinkedIn Scraping** - Scrape profiles and company employees via Apify Actors
- 💾 **Neon PostgreSQL** - Managed database with Drizzle ORM for schema and migrations
- 🔐 **Custom JWT Auth** - Secure authentication with user sessions and RBAC (user_roles)
- 📊 **Profile Analytics** - Career timeline, network visualization, skills analysis
- 👥 **Leads Management** - Track and manage potential leads from company scrapes
- 🏷️ **Tags System** - Organize leads with custom tags and colors
- 📈 **Usage Quotas** - Per-user monthly quotas with tracking
- 🌙 **Dark Mode** - Full dark theme support with toggle
- 📱 **Mobile Optimized** - Responsive design with touch-friendly UI
- ⚡ **Code Splitting** - React.lazy() for optimized loading
- 🛡️ **Error Handling** - ErrorBoundary for graceful error recovery
- ✅ **Input Validation** - Zod schemas for API requests
- 🧪 **Testing** - Vitest for unit testing
- 🎨 **Code Quality** - ESLint and Prettier configured

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Heroicons
- **Backend**: Netlify Functions (TypeScript)
- **Database**: Neon PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Custom JWT (localStorage-based)
- **Scraping**: Apify Actors
- **AI Analysis**: Google Gemini (optional)

## Requirements

- Node.js 20.19+
- npm
- Neon account (database)
- Apify account (scraping)
- Netlify account (hosting)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd linkedin-profile-scrape
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:

- `DATABASE_URL` - Neon PostgreSQL connection string
- `APIFY_TOKEN` - Apify API token
- `JWT_SECRET` - Secret for JWT signing (min 32 chars)

Optional variables:

- `VITE_GEMINI_API_KEY` - Google Gemini API key for AI analysis

### 3. Database Setup

Push schema to Neon:

```bash
npm run db:generate
npx drizzle-kit push
```

Or use migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Create Admin User

```bash
node scripts/create-admin.js admin@example.com your_password
```

### 5. Run Development Server

```bash
npm run dev:netlify
```

Open http://localhost:8888

**Note**: Use `npm run dev:netlify` for full-stack development. `npm run dev` only serves frontend on port 5173 and won't proxy API calls.

## Available Scripts

| Command                 | Description                                   |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Vite frontend only (port 5173)                |
| `npm run dev:netlify`   | Full stack with Netlify Functions (port 8888) |
| `npm run build`         | Production build                              |
| `npm run preview`       | Preview production build                      |
| `npm run db:generate`   | Generate Drizzle migrations                   |
| `npm run db:migrate`    | Run database migrations                       |
| `npm run db:push`       | Push schema to database (dev only)            |
| `npm run db:studio`     | Open Drizzle Studio UI                        |
| `npm run db:health`     | Check database connection                     |
| `npm run test`          | Run tests with Vitest                         |
| `npm run test:ui`       | Run tests with UI                             |
| `npm run test:coverage` | Run tests with coverage report                |
| `npm run lint`          | Run ESLint (fails on warnings)                |
| `npm run lint:fix`      | Auto-fix ESLint issues                        |
| `npm run format`        | Format code with Prettier                     |
| `npm run format:check`  | Check code formatting                         |

## API Endpoints

### Authentication

- `POST /api/auth/signin` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signout` - User logout
- `GET /api/auth/me` - Get current user

### Profiles

- `GET /api/profiles/list` - List user's profiles (with pagination)
- `POST /api/profiles/save` - Save a scraped profile
- `POST /api/profiles/delete` - Delete a profile
- `POST /api/profiles/update-ai` - Update AI summary

### Leads

- `GET /api/leads/list` - List user's leads (with pagination and search)
- `POST /api/leads/batch-delete` - Batch delete leads
- `POST /api/leads/tag` - Tag a lead
- `POST /api/leads/untag` - Untag a lead
- `GET /api/leads/tags` - Get all tags for current user
- `POST /api/leads/tags/create` - Create a new tag
- `POST /api/leads/tags/delete` - Delete a tag

### Admin

- `GET /api/admin/me` - Get user role and permissions
- `POST /api/admin/create-user` - Create a new user
- `GET /api/admin/quotas` - Get all user quotas
- `POST /api/admin/quotas` - Set user quota
- `GET /api/admin/toggles` - Get app settings
- `POST /api/admin/toggles` - Update app settings

### Scraping

- `POST /api/scrape/profile` - Scrape a single LinkedIn profile
- `POST /api/scrape/company` - Scrape employees from a company

### Health

- `GET /api/health` - Check API and database health

## Database Schema

### Tables

- `users` - User accounts
- `sessions` - JWT session tokens
- `user_roles` - User roles (admin/user)
- `app_settings` - Application settings
- `monthly_quotas` - User monthly limits
- `monthly_usage` - Usage tracking
- `linkedin_profiles` - Saved LinkedIn profiles
- `linkedin_leads` - Company employee leads
- `lead_positions` - Lead work experience
- `tags` - Custom tags for leads
- `lead_tags` - Junction table for lead-tag relationships
- `scrape_jobs` - Apify scrape job tracking

### Database Operations

```bash
# Push schema changes (development)
npx drizzle-kit push

# Generate migration files
npx drizzle-kit generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

## Project Structure

```
linkedin-profile-scrape/
├── .github/              # GitHub workflows
├── components/            # React components
│   ├── dashboard/        # Dashboard sub-components
│   ├── charts/           # Visualization components
│   ├── ErrorBoundary.tsx  # Error catching
│   ├── Navbar.tsx        # Navigation
│   └── ...
├── db/                   # Database layer
│   ├── schema.ts         # Drizzle schema definitions
│   ├── client.ts         # Database client
│   └── relations.ts     # Table relationships
├── drizzle/             # Drizzle migrations
├── lib/                 # Utility libraries
│   ├── auth.ts          # Frontend auth client
│   ├── auth-server.ts   # Server auth helpers
│   ├── validation.ts    # Zod schemas
│   └── ...
├── netlify/functions/   # Netlify Functions (API)
│   ├── auth_*.ts        # Auth endpoints
│   ├── admin_*.ts       # Admin endpoints
│   ├── profiles_*.ts    # Profile endpoints
│   ├── leads_*.ts       # Leads endpoints
│   └── scrape.ts        # Scraping endpoints
├── pages/              # Page components
│   ├── Home.tsx         # Dashboard page
│   ├── Profiles.tsx     # Profiles list
│   ├── Leads.tsx        # Leads management
│   ├── Admin.tsx        # Admin panel
│   └── Login.tsx       # Login page
├── scripts/            # Utility scripts
│   ├── create-admin.js  # Create admin user
│   ├── db-health.js     # Check DB connection
│   └── ...
├── services/           # API services
│   ├── api.ts          # API client wrapper
│   ├── apify.ts        # Apify integration
│   ├── auth.ts         # Auth service
│   ├── admin.ts        # Admin service
│   └── gemini.ts       # AI analysis
├── test/              # Test files
├── App.tsx            # Root component
├── vite.config.ts     # Vite configuration
├── tsconfig.json      # TypeScript config
├── drizzle.config.ts  # Drizzle config
└── netlify.toml      # Netlify config
```

## Development Guidelines

See [AGENTS.md](./AGENTS.md) for detailed development guidelines including:

- Code style and conventions
- Component patterns
- Database operations
- Authentication patterns
- Testing guidelines
- Security best practices

## Deployment

### Netlify

1. Connect your repository on Netlify
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
3. Add environment variables:
   - `DATABASE_URL`
   - `APIFY_TOKEN`
   - `JWT_SECRET`
   - (Optional) `VITE_GEMINI_API_KEY`

The `netlify.toml` file includes:

- SPA redirects
- API routing
- Cache headers

Deploy from CLI:

```bash
netlify deploy --build      # Preview deployment
netlify deploy --prod --build  # Production deployment
```

## Common Issues

### Login stuck on /login

- Use `npm run dev:netlify` (http://localhost:8888), not `npm run dev`
- Hard refresh (Shift+Reload)
- Clear localStorage: `localStorage.clear()`
- Check `/api/health` endpoint

### "Quota disabled"

- Set user quota in Admin page
- Or call `POST /api/admin/quotas` with `{ user_id, monthly_limit }`

### "Apify token missing"

- Set `APIFY_TOKEN` in `.env.local` (dev) and Netlify site env (prod)
- Check `/api/health` returns `{ apify: true }`

### Database connection errors

- Verify `DATABASE_URL` format: `postgresql://user:password@host/db?sslmode=require`
- Ensure Neon database is active
- Run `npm run db:health` to test connection

### Build errors

- Run `npm install` to ensure dependencies are up to date
- Delete `node_modules` and reinstall if needed
- Check Node.js version (requires 20.19+)

## Environment Variables

| Variable              | Required | Description                           |
| --------------------- | -------- | ------------------------------------- |
| `DATABASE_URL`        | Yes      | Neon PostgreSQL connection string     |
| `APIFY_TOKEN`         | Yes      | Apify API token for scraping          |
| `JWT_SECRET`          | Yes      | Secret for JWT signing (min 32 chars) |
| `VITE_GEMINI_API_KEY` | No       | Google Gemini API key for AI analysis |

## Security Notes

- **Never commit `.env.local`** - Contains sensitive credentials
- Use a strong `JWT_SECRET` in production (>= 32 random characters)
- Rotate secrets periodically
- APIFY_TOKEN and JWT_SECRET are server-side only (not exposed to browser)
- All API requests require valid JWT token

## Getting API Keys

### Apify

1. Go to https://apify.com
2. Sign up and log in
3. Navigate to Account → Integrations
4. Copy your API Token

### Neon

1. Go to https://console.neon.tech
2. Create a new project
3. Go to Project Settings → Connection Details
4. Copy the connection string

### Google Gemini (Optional)

1. Go to https://ai.google.dev/
2. Click "Get API Key"
3. Create a new API key in Google Cloud Console

## Code Quality

The project uses ESLint and Prettier for code quality:

```bash
# Lint (fails on warnings)
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Testing

```bash
# Run all tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## License

MIT
