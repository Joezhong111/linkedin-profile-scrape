import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { Pool } from 'pg';

// Prefer .env.local in dev; fallback to .env
config({ path: existsSync('.env.local') ? '.env.local' : '.env' });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Add it to .env.local or your environment.');
    process.exit(1);
  }

  const ssl = /supabase\.co|neon\.tech|aws/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;

  const pool = new Pool({ connectionString, ssl, max: 1 });
  const client = await pool.connect();
  try {
    const now = await client.query('select now() as now');
    const db = await client.query('select current_database() as db');
    const tableExists = await client.query("select to_regclass('public.linkedin_profiles') as reg");
    let countInfo = { count: null };
    if (tableExists.rows[0]?.reg) {
      const count = await client.query(
        'select count(*)::int as count from public.linkedin_profiles'
      );
      countInfo = count.rows[0];
    }

    console.log('\n✅ DB connection OK');
    console.log('   now:', now.rows[0].now);
    console.log('   db :', db.rows[0].db);
    console.log('   table linkedin_profiles:', tableExists.rows[0]?.reg ? 'present' : 'missing');
    console.log('   rows:', countInfo.count);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ DB health check failed:', err?.message || err);
  process.exit(1);
});
