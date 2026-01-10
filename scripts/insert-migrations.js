const { Pool } = require('pg');
const { config } = require('dotenv');

config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const migrations = [
      ['0000_dusty_wildide', 1702785600000],
      ['0001_flaky_zombie', 1702785601000],
      ['0002_dashing_champions', 1702785602000],
      ['0003_fixed_leads', 1733510400000],
      ['0004_hesitant_skreet', 1733516700000],
      ['0007_monthly_quotas', 1736523000000],
    ];

    for (const [hash, created_at] of migrations) {
      await client.query(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT (hash) DO NOTHING',
        [hash, created_at]
      );
    }

    await client.query('COMMIT');
    console.log('Migration records inserted successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
