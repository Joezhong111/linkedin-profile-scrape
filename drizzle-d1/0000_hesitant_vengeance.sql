CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY DEFAULT 'global' NOT NULL,
	`registration_open` integer DEFAULT true NOT NULL,
	`google_oauth_open` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "app_settings_singleton" CHECK("app_settings"."id" = 'global')
);
--> statement-breakpoint
CREATE TABLE `company_scrape_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`company_url` text NOT NULL,
	`max_items_requested` integer NOT NULL,
	`items_returned` integer NOT NULL,
	`items_saved` integer NOT NULL,
	`scraped_at` text NOT NULL,
	`filters_used` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_company_scrape_history_owner_company` ON `company_scrape_history` (`owner_id`,`company_url`);--> statement-breakpoint
CREATE TABLE `linkedin_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`owner_id` text NOT NULL,
	`profile_url` text NOT NULL,
	`full_name` text,
	`headline` text,
	`location` text,
	`about` text,
	`photo_url` text,
	`raw_data` text,
	`ai_summary` text,
	`linkedin_public_url` text,
	`linkedin_id` text,
	`public_identifier` text,
	`first_name` text,
	`last_name` text,
	`connections` integer,
	`followers` integer,
	`email` text,
	`mobile_number` text,
	`job_title` text,
	`company_name` text,
	`company_industry` text,
	`company_linkedin` text,
	`source_company_url` text,
	`current_job_duration` text,
	`current_job_duration_years` real,
	`job_period` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_linkedin_leads_owner_url` ON `linkedin_leads` (`owner_id`,`profile_url`);--> statement-breakpoint
CREATE TABLE `linkedin_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`owner_id` text NOT NULL,
	`profile_url` text NOT NULL,
	`full_name` text,
	`headline` text,
	`location` text,
	`about` text,
	`photo_url` text,
	`raw_data` text,
	`ai_summary` text,
	`linkedin_public_url` text,
	`linkedin_id` text,
	`public_identifier` text,
	`first_name` text,
	`last_name` text,
	`connections` integer,
	`followers` integer,
	`email` text,
	`mobile_number` text,
	`address_country_only` text,
	`address_with_country` text,
	`address_without_country` text,
	`profile_pic` text,
	`profile_pic_high_quality` text,
	`background_pic` text,
	`is_premium` integer,
	`is_verified` integer,
	`is_job_seeker` integer,
	`is_retired` integer,
	`is_creator` integer,
	`is_influencer` integer,
	`is_currently_employed` integer,
	`open_connection` integer,
	`urn` text,
	`total_recommendations_received` integer,
	`total_recommendations_given` integer,
	`experiences_count` integer,
	`job_title` text,
	`job_started_on` text,
	`job_location` text,
	`job_still_working` integer,
	`company_name` text,
	`company_industry` text,
	`company_website` text,
	`company_linkedin` text,
	`company_founded_in` integer,
	`company_size` text,
	`current_job_duration` text,
	`current_job_duration_years` real,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_linkedin_profiles_owner_url` ON `linkedin_profiles` (`owner_id`,`profile_url`);--> statement-breakpoint
CREATE TABLE `scrape_job_items` (
	`job_id` text NOT NULL,
	`idx` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`job_id`, `idx`),
	FOREIGN KEY (`job_id`) REFERENCES `scrape_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scrape_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_job_ref` text,
	`job_type` text NOT NULL,
	`input_snapshot` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scrape_jobs_owner_id` ON `scrape_jobs` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_scrape_jobs_status` ON `scrape_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`last_login_at` text,
	`active_provider` text,
	`scrape_credential_ciphertext` text,
	`scrape_credential_iv` text,
	`scrape_credential_validated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);