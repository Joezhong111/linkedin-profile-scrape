import pg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const { Pool } = pg;

async function createTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Creating company_scrape_history table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "company_scrape_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_id" uuid NOT NULL,
        "company_url" text NOT NULL,
        "max_items_requested" integer NOT NULL,
        "items_returned" integer NOT NULL,
        "items_saved" integer NOT NULL,
        "scraped_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        "filters_used" jsonb
      )
    `);
    console.log('✓ Table created');

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'company_scrape_history_owner_id_users_id_fk'
        ) THEN
          ALTER TABLE "company_scrape_history"
          ADD CONSTRAINT "company_scrape_history_owner_id_users_id_fk"
          FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id")
          ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);
    console.log('✓ Foreign key added');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_scrape_history_owner_company"
      ON "company_scrape_history" USING btree ("owner_id","company_url")
    `);
    console.log('✓ Index created');

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'company_scrape_history'
    `);

    console.log('\n✓ Table verification:', result.rows.length > 0 ? 'SUCCESS' : 'FAILED');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTable();
