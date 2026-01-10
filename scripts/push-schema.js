import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { Pool } from 'pg';

// Prefer .env.local in dev; fallback to .env
config({ path: existsSync('.env.local') ? '.env.local' : '.env' });

async function pushSchema() {
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
    await client.query('BEGIN');

    // Create all tables
    await client.query(`
      CREATE TABLE "app_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "registration_open" boolean DEFAULT true NOT NULL,
        "google_oauth_open" boolean DEFAULT true NOT NULL,
        "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    console.log('Created: app_settings');

    await client.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "full_name" text,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        "email_verified" boolean DEFAULT false NOT NULL,
        "last_login_at" timestamp with time zone,
        CONSTRAINT "users_email_unique" UNIQUE("email")
      );
    `);
    console.log('Created: users');

    await client.query(`
      CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "token" text NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        CONSTRAINT "sessions_token_unique" UNIQUE("token")
      );
    `);
    console.log('Created: sessions');

    await client.query(`
      CREATE TABLE "user_roles" (
        "user_id" uuid PRIMARY KEY NOT NULL,
        "role" text DEFAULT 'user' NOT NULL,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    console.log('Created: user_roles');

    await client.query(`
      CREATE TABLE "monthly_quotas" (
        "user_id" uuid PRIMARY KEY NOT NULL,
        "monthly_limit" integer DEFAULT 0 NOT NULL,
        "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    console.log('Created: monthly_quotas');

    await client.query(`
      CREATE TABLE "monthly_usage" (
        "user_id" uuid NOT NULL,
        "period_start" timestamp with time zone NOT NULL,
        "period_end" timestamp with time zone NOT NULL,
        "used_count" integer DEFAULT 0 NOT NULL,
        "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        CONSTRAINT "monthly_usage_user_id_period_start_pk" PRIMARY KEY("user_id","period_start")
      );
    `);
    console.log('Created: monthly_usage');

    await client.query(`
      CREATE TABLE "tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_id" uuid NOT NULL,
        "name" text NOT NULL,
        "color" text DEFAULT '#3b82f6' NOT NULL,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    console.log('Created: tags');

    await client.query(`
      CREATE TABLE "linkedin_leads" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        "owner_id" uuid NOT NULL,
        "profile_url" text NOT NULL,
        "full_name" text,
        "headline" text,
        "location" text,
        "about" text,
        "photo_url" text,
        "raw_data" jsonb,
        "ai_summary" text,
        "linkedin_public_url" text,
        "linkedin_id" text,
        "public_identifier" text,
        "first_name" text,
        "last_name" text,
        "connections" integer,
        "followers" bigint,
        "email" text,
        "mobile_number" text,
        "job_title" text,
        "company_name" text,
        "company_industry" text,
        "company_linkedin" text,
        "source_company_url" text,
        "current_job_duration" text,
        "job_period" text,
        CONSTRAINT "linkedin_leads_pkey" PRIMARY KEY("id")
      );
    `);
    console.log('Created: linkedin_leads');

    await client.query(`
      CREATE TABLE "linkedin_profiles" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        "owner_id" uuid NOT NULL,
        "profile_url" text NOT NULL,
        "full_name" text,
        "headline" text,
        "location" text,
        "about" text,
        "photo_url" text,
        "raw_data" jsonb,
        "ai_summary" text,
        "linkedin_public_url" text,
        "linkedin_id" text,
        "public_identifier" text,
        "first_name" text,
        "last_name" text,
        "connections" integer,
        "followers" bigint,
        "email" text,
        "mobile_number" text,
        "address_country_only" text,
        "address_with_country" text,
        "address_without_country" text,
        "profile_pic" text,
        "profile_pic_high_quality" text,
        "background_pic" text,
        "is_premium" boolean,
        "is_verified" boolean,
        "is_job_seeker" boolean,
        "is_retired" boolean,
        "is_creator" boolean,
        "is_influencer" boolean,
        "is_currently_employed" boolean,
        "open_connection" boolean,
        "urn" text,
        "total_recommendations_received" integer,
        "total_recommendations_given" integer,
        "experiences_count" integer,
        "job_title" text,
        "job_started_on" text,
        "job_location" text,
        "job_still_working" boolean,
        "company_name" text,
        "company_industry" text,
        "company_website" text,
        "company_linkedin" text,
        "company_founded_in" integer,
        "company_size" text,
        "current_job_duration" text,
        "current_job_duration_years" numeric,
        CONSTRAINT "linkedin_profiles_pkey" PRIMARY KEY("id")
      );
    `);
    console.log('Created: linkedin_profiles');

    await client.query(`
      CREATE TABLE "lead_tags" (
        "lead_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        CONSTRAINT "lead_tags_lead_id_tag_id_pk" PRIMARY KEY("lead_id","tag_id")
      );
    `);
    console.log('Created: lead_tags');

    // Create foreign key constraints
    await client.query(`
      ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: sessions -> users');

    await client.query(`
      ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: user_roles -> users');

    await client.query(`
      ALTER TABLE "monthly_quotas" ADD CONSTRAINT "monthly_quotas_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: monthly_quotas -> users');

    await client.query(`
      ALTER TABLE "monthly_usage" ADD CONSTRAINT "monthly_usage_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: monthly_usage -> users');

    await client.query(`
      ALTER TABLE "tags" ADD CONSTRAINT "tags_owner_id_users_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: tags -> users');

    await client.query(`
      ALTER TABLE "linkedin_leads" ADD CONSTRAINT "linkedin_leads_owner_id_users_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: linkedin_leads -> users');

    await client.query(`
      ALTER TABLE "linkedin_profiles" ADD CONSTRAINT "linkedin_profiles_owner_id_users_id_fk"
      FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: linkedin_profiles -> users');

    await client.query(`
      ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_linkedin_leads_id_fk"
      FOREIGN KEY ("lead_id") REFERENCES "public"."linkedin_leads"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: lead_tags -> linkedin_leads');

    await client.query(`
      ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tag_id_tags_id_fk"
      FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log('Added FK: lead_tags -> tags');

    // Create indexes
    await client.query(`
      CREATE UNIQUE INDEX "ux_linkedin_leads_owner_url"
      ON "linkedin_leads" USING btree ("owner_id","profile_url");
    `);
    console.log('Created index: ux_linkedin_leads_owner_url');

    await client.query(`
      CREATE UNIQUE INDEX "ux_linkedin_profiles_owner_url"
      ON "linkedin_profiles" USING btree ("owner_id","profile_url");
    `);
    console.log('Created index: ux_linkedin_profiles_owner_url');

    // Create default app settings
    await client.query(`
      INSERT INTO "app_settings" (id, registration_open, google_oauth_open)
      VALUES (gen_random_uuid(), true, true);
    `);
    console.log('Created default app_settings');

    await client.query('COMMIT');
    console.log('\n✅ All tables created successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

pushSchema();
