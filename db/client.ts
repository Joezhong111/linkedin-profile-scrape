import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your environment.");
}

// Enable SSL for hosted Postgres providers like Supabase
const ssl = /supabase\.co|neon\.tech|aws/.test(connectionString)
  ? { rejectUnauthorized: false }
  : undefined;

export const pool = new Pool({ connectionString, ssl, max: 3 });
export const db = drizzle(pool);

// Example: import { db } from "../db/client"; then use db.select().from(...)
