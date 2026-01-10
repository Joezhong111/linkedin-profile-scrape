import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      ORDER BY tablename
    `);
    console.log('Current tables in database:');
    for (const row of tables.rows) {
      console.log('  -', row.tablename);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables();
