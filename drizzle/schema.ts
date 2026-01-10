import { pgTable, uuid, boolean, timestamp, unique, text, uniqueIndex, foreignKey, jsonb, integer, bigint, numeric, index, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const appSettings = pgTable("app_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	registrationOpen: boolean("registration_open").default(true).notNull(),
	googleOauthOpen: boolean("google_oauth_open").default(true).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	fullName: text("full_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const linkedinProfiles = pgTable("linkedin_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	ownerId: uuid("owner_id").notNull(),
	profileUrl: text("profile_url").notNull(),
	fullName: text("full_name"),
	headline: text(),
	location: text(),
	about: text(),
	photoUrl: text("photo_url"),
	rawData: jsonb("raw_data"),
	aiSummary: text("ai_summary"),
	linkedinPublicUrl: text("linkedin_public_url"),
	linkedinId: text("linkedin_id"),
	publicIdentifier: text("public_identifier"),
	firstName: text("first_name"),
	lastName: text("last_name"),
	connections: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	followers: bigint({ mode: "number" }),
	email: text(),
	mobileNumber: text("mobile_number"),
	addressCountryOnly: text("address_country_only"),
	addressWithCountry: text("address_with_country"),
	addressWithoutCountry: text("address_without_country"),
	profilePic: text("profile_pic"),
	profilePicHighQuality: text("profile_pic_high_quality"),
	backgroundPic: text("background_pic"),
	isPremium: boolean("is_premium"),
	isVerified: boolean("is_verified"),
	isJobSeeker: boolean("is_job_seeker"),
	isRetired: boolean("is_retired"),
	isCreator: boolean("is_creator"),
	isInfluencer: boolean("is_influencer"),
	isCurrentlyEmployed: boolean("is_currently_employed"),
	openConnection: boolean("open_connection"),
	urn: text(),
	totalRecommendationsReceived: integer("total_recommendations_received"),
	totalRecommendationsGiven: integer("total_recommendations_given"),
	experiencesCount: integer("experiences_count"),
	jobTitle: text("job_title"),
	jobStartedOn: text("job_started_on"),
	jobLocation: text("job_location"),
	jobStillWorking: boolean("job_still_working"),
	companyName: text("company_name"),
	companyIndustry: text("company_industry"),
	companyWebsite: text("company_website"),
	companyLinkedin: text("company_linkedin"),
	companyFoundedIn: integer("company_founded_in"),
	companySize: text("company_size"),
	currentJobDuration: text("current_job_duration"),
	currentJobDurationYears: numeric("current_job_duration_years"),
}, (table) => [
	uniqueIndex("ux_linkedin_profiles_owner_url").using("btree", table.ownerId.asc().nullsLast().op("text_ops"), table.profileUrl.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "linkedin_profiles_owner_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("sessions_token_unique").on(table.token),
]);

export const userRoles = pgTable("user_roles", {
	userId: uuid("user_id").primaryKey().notNull(),
	role: text().default('user').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const monthlyQuotas = pgTable("monthly_quotas", {
	userId: uuid("user_id").primaryKey().notNull(),
	monthlyLimit: integer("monthly_limit").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "monthly_quotas_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const linkedinLeads = pgTable("linkedin_leads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	ownerId: uuid("owner_id").notNull(),
	profileUrl: text("profile_url").notNull(),
	fullName: text("full_name"),
	headline: text(),
	location: text(),
	about: text(),
	photoUrl: text("photo_url"),
	rawData: jsonb("raw_data"),
	aiSummary: text("ai_summary"),
	linkedinPublicUrl: text("linkedin_public_url"),
	linkedinId: text("linkedin_id"),
	publicIdentifier: text("public_identifier"),
	firstName: text("first_name"),
	lastName: text("last_name"),
	connections: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	followers: bigint({ mode: "number" }),
	email: text(),
	mobileNumber: text("mobile_number"),
	jobTitle: text("job_title"),
	companyName: text("company_name"),
	companyIndustry: text("company_industry"),
	companyLinkedin: text("company_linkedin"),
	sourceCompanyUrl: text("source_company_url"),
	currentJobDuration: text("current_job_duration"),
	jobPeriod: text("job_period"),
}, (table) => [
	uniqueIndex("ux_linkedin_leads_owner_url").using("btree", table.ownerId.asc().nullsLast().op("text_ops"), table.profileUrl.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "linkedin_leads_owner_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid("owner_id").notNull(),
	name: text().notNull(),
	color: text().default('#3b82f6').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "tags_owner_id_fkey"
		}).onDelete("cascade"),
]);

export const scrapeJobs = pgTable("scrape_jobs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid("owner_id").notNull(),
	apifyRunId: text("apify_run_id"),
	jobType: text("job_type").notNull(),
	inputData: jsonb("input_data").notNull(),
	status: text().default('pending').notNull(),
	progress: integer().default(0),
	resultCount: integer("result_count").default(0),
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0),
	maxRetries: integer("max_retries").default(3),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_scrape_jobs_apify_run_id").using("btree", table.apifyRunId.asc().nullsLast().op("text_ops")),
	index("idx_scrape_jobs_owner_id").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops")),
	index("idx_scrape_jobs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "scrape_jobs_owner_id_fkey"
		}).onDelete("cascade"),
]);

export const leadPositions = pgTable("lead_positions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	leadId: uuid("lead_id").notNull(),
	title: text().notNull(),
	companyName: text("company_name"),
	companyUrl: text("company_url"),
	companyIndustry: text("company_industry"),
	startDate: text("start_date"),
	endDate: text("end_date"),
	isCurrent: boolean("is_current").default(false),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_lead_positions_lead_id").using("btree", table.leadId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [linkedinLeads.id],
			name: "lead_positions_lead_id_fkey"
		}).onDelete("cascade"),
]);

export const leadTags = pgTable("lead_tags", {
	leadId: uuid("lead_id").notNull(),
	tagId: uuid("tag_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [linkedinLeads.id],
			name: "lead_tags_lead_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "lead_tags_tag_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.leadId, table.tagId], name: "lead_tags_pkey"}),
]);

export const monthlyUsage = pgTable("monthly_usage", {
	userId: uuid("user_id").notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	usedCount: integer("used_count").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "monthly_usage_user_id_users_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.periodStart], name: "monthly_usage_user_id_period_start_pk"}),
]);
