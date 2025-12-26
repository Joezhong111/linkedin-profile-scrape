import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  integer,
  bigint,
  boolean,
  numeric,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================
// Authentication & User Management
// ============================================

// Users table - replaces Supabase Auth
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", {
    withTimezone: true,
    mode: "string",
  }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Sessions table for JWT token management
export const sessions = pgTable("sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// ============================================
// LinkedIn Profiles
// ============================================
export const linkedinProfiles = pgTable(
  "linkedin_profiles",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),

    // Owner - references users table
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    profileUrl: text("profile_url").notNull(),
    fullName: text("full_name"),
    headline: text("headline"),
    location: text("location"),
    about: text("about"),
    photoUrl: text("photo_url"),

    rawData: jsonb("raw_data"),
    aiSummary: text("ai_summary"),

    linkedinPublicUrl: text("linkedin_public_url"),
    linkedinId: text("linkedin_id"),
    publicIdentifier: text("public_identifier"),
    firstName: text("first_name"),
    lastName: text("last_name"),

    connections: integer("connections"),
    // followers is BIGINT in DB. If you expect values < 2^53-1, using mode: 'number' is convenient.
    followers: bigint("followers", { mode: "number" }),

    email: text("email"),
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

    urn: text("urn"),

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
    currentJobDurationYears: numeric("current_job_duration_years", {
      mode: "number",
    }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id], name: "linkedin_profiles_pkey" }),
    uxOwnerUrl: uniqueIndex("ux_linkedin_profiles_owner_url").on(
      t.ownerId,
      t.profileUrl
    ),
  })
);

// ============================================
// LinkedIn Leads (from Company Scrape)
// ============================================
export const linkedinLeads = pgTable(
  "linkedin_leads",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),

    // Owner - references users table
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    profileUrl: text("profile_url").notNull(),
    fullName: text("full_name"),
    headline: text("headline"),
    location: text("location"),
    about: text("about"),
    photoUrl: text("photo_url"),

    rawData: jsonb("raw_data"),
    aiSummary: text("ai_summary"),

    linkedinPublicUrl: text("linkedin_public_url"),
    linkedinId: text("linkedin_id"),
    publicIdentifier: text("public_identifier"),
    firstName: text("first_name"),
    lastName: text("last_name"),

    connections: integer("connections"),
    followers: bigint("followers", { mode: "number" }),

    email: text("email"),
    mobileNumber: text("mobile_number"),

    jobTitle: text("job_title"),
    companyName: text("company_name"),
    companyIndustry: text("company_industry"),
    companyLinkedin: text("company_linkedin"),

    // Specifically track which company URL this lead came from
    sourceCompanyUrl: text("source_company_url"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id], name: "linkedin_leads_pkey" }),
    uxOwnerUrl: uniqueIndex("ux_linkedin_leads_owner_url").on(
      t.ownerId,
      t.profileUrl
    ),
  })
);

export type LinkedInLead = typeof linkedinLeads.$inferSelect;
export type NewLinkedInLead = typeof linkedinLeads.$inferInsert;

export type LinkedInProfile = typeof linkedinProfiles.$inferSelect;
export type NewLinkedInProfile = typeof linkedinProfiles.$inferInsert;

// ============================================
// RBAC & Quotas Schema
// ============================================

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
});

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

export const appSettings = pgTable("app_settings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  registrationOpen: boolean("registration_open").notNull().default(true),
  googleOauthOpen: boolean("google_oauth_open").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
});

export const apifyQuotas = pgTable("apify_quotas", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dailyLimit: integer("daily_limit").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
});

export type ApifyQuota = typeof apifyQuotas.$inferSelect;
export type NewApifyQuota = typeof apifyQuotas.$inferInsert;

export const apifyUsage = pgTable(
  "apify_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: timestamp("day", { mode: "string" }).notNull(), // Using timestamp for date part
    usedCount: integer("used_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.day] }),
  })
);

export type ApifyUsage = typeof apifyUsage.$inferSelect;
export type NewApifyUsage = typeof apifyUsage.$inferInsert;
