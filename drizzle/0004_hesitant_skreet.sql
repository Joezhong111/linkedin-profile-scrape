CREATE TABLE "lead_tags" (
	"lead_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "lead_tags_lead_id_tag_id_pk" PRIMARY KEY("lead_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_linkedin_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."linkedin_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;