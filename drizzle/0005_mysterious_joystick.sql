CREATE TABLE "company_scrape_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"company_url" text NOT NULL,
	"max_items_requested" integer NOT NULL,
	"items_returned" integer NOT NULL,
	"items_saved" integer NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"filters_used" jsonb
);
--> statement-breakpoint
CREATE TABLE "lead_positions" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"title" text NOT NULL,
	"company_name" text,
	"company_url" text,
	"company_industry" text,
	"start_date" text,
	"end_date" text,
	"is_current" boolean DEFAULT false,
	"description" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_jobs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"apify_run_id" text,
	"job_type" text NOT NULL,
	"input_data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"result_count" integer DEFAULT 0,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_scrape_history" ADD CONSTRAINT "company_scrape_history_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_positions" ADD CONSTRAINT "lead_positions_lead_id_linkedin_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."linkedin_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_scrape_history_owner_company" ON "company_scrape_history" USING btree ("owner_id","company_url");--> statement-breakpoint
CREATE INDEX "idx_lead_positions_lead_id" ON "lead_positions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_scrape_jobs_apify_run_id" ON "scrape_jobs" USING btree ("apify_run_id");--> statement-breakpoint
CREATE INDEX "idx_scrape_jobs_owner_id" ON "scrape_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_scrape_jobs_status" ON "scrape_jobs" USING btree ("status");