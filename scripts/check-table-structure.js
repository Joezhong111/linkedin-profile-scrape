import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function checkTableStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('linkedin_leads table structure:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'linkedin_leads'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    for (const col of columns.rows) {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }

    console.log('\nlinkedin_profiles table structure:');
    const profileCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'linkedin_profiles'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    for (const col of profileCols.rows) {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableStructure();
