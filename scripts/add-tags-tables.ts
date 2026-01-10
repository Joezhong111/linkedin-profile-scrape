import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  console.log('Adding tags and lead_tags tables...');

  try {
    // Create tags table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS "tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "color" text DEFAULT '#3b82f6' NOT NULL,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;
    console.log('✓ tags table created/verified');

    // Create lead_tags table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS "lead_tags" (
        "lead_id" uuid NOT NULL REFERENCES "linkedin_leads"("id") ON DELETE CASCADE,
        "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        PRIMARY KEY ("lead_id", "tag_id")
      );
    `;
    console.log('✓ lead_tags table created/verified');

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
