import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { Pool } from 'pg';

// Prefer .env.local in dev; fallback to .env
config({ path: existsSync('.env.local') ? '.env.local' : '.env' });

async function dropAllTables() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const ssl = /supabase\.co|neon\.tech|aws/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;

  const pool = new Pool({ connectionString, ssl, max: 1 });
  const client = await pool.connect();

  try {
    // Get all tables in public schema
    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
    `);

    console.log(`Found ${tables.rows.length} tables to drop:`);
    for (const row of tables.rows) {
      console.log(`  - ${row.tablename}`);
    }

    // Drop all tables in a transaction
    await client.query('BEGIN');
    for (const row of tables.rows) {
      console.log(`Dropping table: ${row.tablename}`);
      await client.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
    }
    await client.query('COMMIT');

    console.log('\n✅ All tables dropped successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error dropping tables:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

dropAllTables();
