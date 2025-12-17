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

  const testUrl = `smoke-test-${new Date().toISOString()}`;

  try {
    await client.query('begin');

    const inserted = await client.query(
      `insert into public.linkedin_profiles (profile_url, full_name)
       values ($1, $2)
       returning id, created_at`,
      [testUrl, 'Smoke Test']
    );

    const row = inserted.rows[0];
    const countAfterInsert = await client.query(
      `select count(*)::int as count from public.linkedin_profiles where profile_url = $1`,
      [testUrl]
    );

    await client.query(
      `delete from public.linkedin_profiles where profile_url = $1`,
      [testUrl]
    );

    await client.query('commit');

    console.log('\n✅ Smoke insert OK');
    console.log('   inserted id :', row.id);
    console.log('   created_at  :', row.created_at);
    console.log('   present rows:', countAfterInsert.rows[0].count);
    console.log('   cleanup     : done');
  } catch (err) {
    await client.query('rollback');
    console.error('\n❌ Smoke test failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

