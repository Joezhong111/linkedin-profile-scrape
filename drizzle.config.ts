import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { existsSync } from "node:fs";

// Prefer .env.local in dev; fallback to .env
config({ path: existsSync(".env.local") ? ".env.local" : ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to .env.local or .env");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
