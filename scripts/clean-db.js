#!/usr/bin/env node
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Dropping all tables...');

  const tables = [
    'lead_tags',
    'linkedin_leads',
    'linkedin_profiles',
    'monthly_quotas',
    'monthly_usage',
    'sessions',
    'tags',
    'user_roles',
    'users',
    'app_settings',
    'drizzle_sessions',
  ];

  for (const table of tables) {
    try {
      await sql(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      console.log(`Dropped ${table}`);
    } catch (e) {
      console.log(`Skipping ${table}: ${e.message}`);
    }
  }

  console.log('Database cleaned!');
}

main().catch(console.error);
