import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to your environment.');
}

// Enable SSL for hosted Postgres providers like Supabase
const ssl = /supabase\.co|neon\.tech|aws/.test(connectionString)
  ? { rejectUnauthorized: false }
  : undefined;

// Configure pool with connection lifecycle management to prevent SSL timeouts
export const pool = new Pool({
  connectionString,
  ssl,
  max: 5, // Max connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout for new connections
  allowExitOnIdle: true, // Allow process to exit when pool is idle
});

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

export const db = drizzle(pool);

// Example: import { db } from "../db/client"; then use db.select().from(...)
