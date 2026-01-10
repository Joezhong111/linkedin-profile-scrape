# LinkedIn Insights Pro - Agent Guidelines

## Build & Development Commands

```bash
# Development (recommended)
npm run dev:netlify    # Full stack dev - localhost:8888
npm run dev            # Vite frontend only - localhost:5173

# Build
npm run build          # Build production bundle
npm run preview        # Preview production build

# Database
npm run db:generate    # Generate Drizzle migrations
npx drizzle-kit push   # Push schema to DB
npm run db:migrate     # Run migrations
npm run db:studio      # Open Drizzle Studio UI
npm run db:health      # Check DB connection
node scripts/create-admin.js <email> <password>  # Create admin user

# Testing
npm run test              # Run tests with Vitest
npm run test:ui           # Run tests with UI
npm run test:coverage     # Run tests with coverage report

# Code Quality
npm run lint              # Run ESLint (fails on warnings)
npm run lint:fix          # Run ESLint and auto-fix issues
npm run format            # Format code with Prettier
npm run format:check      # Check code formatting
```

## Project Architecture

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Netlify Functions (TypeScript)
- **Database**: Neon PostgreSQL + Drizzle ORM
- **Auth**: Custom JWT (no Supabase Auth)
- **Scraping**: Apify Actors
- **Routing**: Hash-based (#/dashboard, #/profiles, #/leads, #/admin, #/login)

## File Naming

- Components/Pages: `PascalCase.tsx` (e.g., `Navbar.tsx`, `Dashboard.tsx`)
- Services/Lib: `camelCase.ts` (e.g., `api.ts`, `auth.ts`, `auth-server.ts`)
- Netlify Functions: `snake_case.ts` (e.g., `auth_signin.ts`, `profiles_save.ts`)
- DB files: `schema.ts`, `client.ts`

## Import Style

```typescript
// External libraries first, then internal with @/ alias
import React, { useState, useEffect } from 'react';
import { eq, and, desc } from 'drizzle-orm';
import { authClient } from '@/lib/auth';
import { db } from '@/db/client';
import { users, linkedinProfiles } from '@/db/schema';
import { LinkedInProfile } from '@/types';
```

## TypeScript Patterns

```typescript
// Component props interface
interface Props {
  profile: LinkedInProfile;
  onSave: (data: any) => void;
}

// Drizzle type inference
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// API interfaces
export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: string;
}
```

## Component Pattern

```typescript
const MyComponent: React.FC<Props> = ({ profile, onSave }) => {
  const [state, setState] = useState<T>(initialValue);
  useEffect(() => { /* effect */ }, [deps]);
  return <div>{/* JSX */}</div>;
};
export default MyComponent;
```

## Error Handling

```typescript
// Client API functions
export const saveProfile = async (profile: LinkedInProfile) => {
  const res = await fetch('/api/profiles/save', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || 'Failed');
  }
  return await res.json();
};

// Netlify Functions
export const handler = async (event: any) => {
  try {
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Server error' };
  }
};
```

## Authentication

```typescript
// Client: use authClient
import { authClient } from '@/lib/auth';
const user = authClient.getUser();
const headers = authClient.getAuthHeaders(); // Includes Authorization: Bearer <token>

// Server: verify token in Netlify Functions
import { verifyToken, extractToken } from '@/lib/auth-server';
const token = extractToken(event.headers?.authorization);
if (!token) return { statusCode: 401, body: 'Unauthorized' };
const user = await verifyToken(token);
```

## Database Operations (Drizzle ORM)

```typescript
// Select
await db
  .select()
  .from(linkedinProfiles)
  .where(and(eq(linkedinProfiles.ownerId, userId), eq(linkedinProfiles.profileUrl, url)))
  .orderBy(desc(linkedinProfiles.createdAt))
  .limit(10);

// Insert/Update/Delete
await db.insert(linkedinProfiles).values(data).returning();
await db.update(linkedinProfiles).set(update).where(eq(id, id)).returning();
await db.delete(linkedinProfiles).where(eq(id, id));
```

## Naming Conventions

- **DB columns**: `snake_case` (e.g., `created_at`, `owner_id`, `profile_url`)
- **TS interfaces**: `camelCase` (e.g., `createdAt`, `ownerId`, `profileUrl`)
- **Mapping**: Create `mapRowToClient()` functions to convert DB rows to API responses

```typescript
function mapRowToClient(r: any) {
  return { created_at: r.createdAt, owner_id: r.ownerId, profile_url: r.profileUrl };
}
```

## Environment Variables

**Server-side** (Netlify Functions): `DATABASE_URL`, `APIFY_TOKEN`, `JWT_SECRET` (min 32 chars)
**Client-side** (prefixed `VITE_`): `VITE_APIFY_TOKEN`

## Input Validation with Zod

All API requests should use Zod schemas for validation:

```typescript
// Define validation schema in lib/validation.ts
import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Use in Netlify Functions
import { signInSchema } from '../../lib/validation';

const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
const validationResult = signInSchema.safeParse(body);

if (!validationResult.success) {
  const errors = validationResult.error.issues
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
  return { statusCode: 400, body: errors };
}

const { email, password } = validationResult.data;
```

## Code Splitting with React.lazy

Pages are lazy-loaded for better performance:

```typescript
import React, { Suspense } from "react";
const Home = React.lazy(() => import("./pages/Home"));
const Profiles = React.lazy(() => import("./pages/Profiles"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

<Suspense fallback={<PageLoader />}>
  <Home />
  <Profiles />
</Suspense>
```

## Error Boundary

All app components are wrapped in ErrorBoundary to catch runtime errors:

```typescript
import ErrorBoundary from "./components/ErrorBoundary";

<ErrorBoundary>
  <YourApp />
</ErrorBoundary>
```

- In development: Shows error details and component stack
- In production: Shows user-friendly error message with refresh option
- Automatically logs errors to console (extend to external logging service)

## Styling

Tailwind CSS with dark mode: `className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg"`
Responsive: `sm:`, `md:`, `lg:` breakpoints

## Context Providers

```typescript
const Context = createContext<Type | undefined>(undefined);
export function Provider({ children }: { children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useContext() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useContext must be used within Provider");
  return ctx;
}
```

## Netlify Function Naming

`<resource>_<action>.ts` pattern: `auth_signin.ts`, `profiles_save.ts`, `leads_list.ts`, `admin_quotas.ts`

## Security Guidelines

- Never commit `.env.local` or `.env` files
- Validate all user inputs (email format, required fields)
- Always check authentication in API handlers
- Use parameterized queries (Drizzle handles this)
- Set strong `JWT_SECRET` (min 32 chars)
- Store passwords hashed (`crypto.pbkdf2Sync`)
- Use SSL for DB connections

## Common Gotchas

- **Vite vs Netlify Dev**: Use `npm run dev:netlify` for full-stack dev. `npm run dev` only serves frontend (404 on `/api/*`)
- **TypeScript `any`**: Minimize use. Only for external API responses (Apify) where schema is dynamic
- **Date handling**: Store as ISO strings, convert to Date when needed
- **Pagination**: Always validate `page`/`pageSize` to prevent negative/excessive values
- **Zod validation errors**: Use `.safeParse()` and check `.success` before accessing `.data`
- **React lazy imports**: Must be wrapped in `<Suspense>` with a fallback component
- **Error Boundary**: Catches only runtime errors during rendering, not event handlers or async code
