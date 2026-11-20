import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const uuid = (name: string) =>
  text(name).$defaultFn(() => crypto.randomUUID());

const now = (name: string) =>
  text(name).$defaultFn(() => new Date().toISOString());

// ============================================
// Authentication & User Management
// ============================================

export const users = sqliteTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name'),
  createdAt: now('created_at').notNull(),
  updatedAt: now('updated_at').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  lastLoginAt: text('last_login_at'),
  // One active provider and one encrypted Scrape Credential per User.
  activeProvider: text('active_provider', { enum: ['apify', 'treg'] }),
  scrapeCredentialCiphertext: text('scrape_credential_ciphertext'),
  scrapeCredentialIv: text('scrape_credential_iv'),
  scrapeCredentialValidatedAt: text('scrape_credential_validated_at'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Sessions table for opaque session tokens.
export const sessions = sqliteTable('sessions', {
  id: uuid('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: now('created_at').notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// ============================================
// LinkedIn Profiles
// ============================================
export const linkedinProfiles = sqliteTable(
  'linkedin_profiles',
  {
    id: uuid('id').primaryKey(),
    createdAt: now('created_at').notNull(),

    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    profileUrl: text('profile_url').notNull(),
    fullName: text('full_name'),
    headline: text('headline'),
    location: text('location'),
    about: text('about'),
    photoUrl: text('photo_url'),

    rawData: text('raw_data', { mode: 'json' }),

    linkedinPublicUrl: text('linkedin_public_url'),
    linkedinId: text('linkedin_id'),
    publicIdentifier: text('public_identifier'),
    firstName: text('first_name'),
    lastName: text('last_name'),

    connections: integer('connections'),
    followers: integer('followers', { mode: 'number' }),

    email: text('email'),
    mobileNumber: text('mobile_number'),

    addressCountryOnly: text('address_country_only'),
    addressWithCountry: text('address_with_country'),
    addressWithoutCountry: text('address_without_country'),

    profilePic: text('profile_pic'),
    profilePicHighQuality: text('profile_pic_high_quality'),
    backgroundPic: text('background_pic'),

    isPremium: integer('is_premium', { mode: 'boolean' }),
    isVerified: integer('is_verified', { mode: 'boolean' }),
    isJobSeeker: integer('is_job_seeker', { mode: 'boolean' }),
    isRetired: integer('is_retired', { mode: 'boolean' }),
    isCreator: integer('is_creator', { mode: 'boolean' }),
    isInfluencer: integer('is_influencer', { mode: 'boolean' }),
    isCurrentlyEmployed: integer('is_currently_employed', { mode: 'boolean' }),
    openConnection: integer('open_connection', { mode: 'boolean' }),

    urn: text('urn'),

    totalRecommendationsReceived: integer('total_recommendations_received'),
    totalRecommendationsGiven: integer('total_recommendations_given'),
    experiencesCount: integer('experiences_count'),

    jobTitle: text('job_title'),
    jobStartedOn: text('job_started_on'),
    jobLocation: text('job_location'),
    jobStillWorking: integer('job_still_working', { mode: 'boolean' }),

    companyName: text('company_name'),
    companyIndustry: text('company_industry'),
    companyWebsite: text('company_website'),
    companyLinkedin: text('company_linkedin'),
    companyFoundedIn: integer('company_founded_in'),
    companySize: text('company_size'),

    currentJobDuration: text('current_job_duration'),
    currentJobDurationYears: real('current_job_duration_years'),
  },
  (t) => [uniqueIndex('ux_linkedin_profiles_owner_url').on(t.ownerId, t.profileUrl)]
);

export type LinkedInProfile = typeof linkedinProfiles.$inferSelect;
export type NewLinkedInProfile = typeof linkedinProfiles.$inferInsert;

// ============================================
// LinkedIn Leads (from Company Scrape)
// ============================================
export const linkedinLeads = sqliteTable(
  'linkedin_leads',
  {
    id: uuid('id').primaryKey(),
    createdAt: now('created_at').notNull(),

    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    profileUrl: text('profile_url').notNull(),
    fullName: text('full_name'),
    headline: text('headline'),
    location: text('location'),
    about: text('about'),
    photoUrl: text('photo_url'),

    rawData: text('raw_data', { mode: 'json' }),

    linkedinPublicUrl: text('linkedin_public_url'),
    linkedinId: text('linkedin_id'),
    publicIdentifier: text('public_identifier'),
    firstName: text('first_name'),
    lastName: text('last_name'),

    connections: integer('connections'),
    followers: integer('followers', { mode: 'number' }),

    email: text('email'),
    mobileNumber: text('mobile_number'),

    isPremium: integer('is_premium', { mode: 'boolean' }),
    isVerified: integer('is_verified', { mode: 'boolean' }),

    jobTitle: text('job_title'),
    companyName: text('company_name'),
    companyIndustry: text('company_industry'),
    companyLinkedin: text('company_linkedin'),

    sourceCompanyUrl: text('source_company_url'),
    currentJobDuration: text('current_job_duration'),
    currentJobDurationYears: real('current_job_duration_years'),
    jobPeriod: text('job_period'),
  },
  (t) => [uniqueIndex('ux_linkedin_leads_owner_url').on(t.ownerId, t.profileUrl)]
);

export type LinkedInLead = typeof linkedinLeads.$inferSelect;
export type NewLinkedInLead = typeof linkedinLeads.$inferInsert;

// ============================================
// RBAC & Settings
// ============================================

export const userRoles = sqliteTable('user_roles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'user'] })
    .notNull()
    .default('user'),
  createdAt: now('created_at').notNull(),
});

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

export const appSettings = sqliteTable(
  'app_settings',
  {
    id: text('id').primaryKey().default('global'),
    registrationOpen: integer('registration_open', { mode: 'boolean' }).notNull().default(true),
    googleOauthOpen: integer('google_oauth_open', { mode: 'boolean' }).notNull().default(true),
    updatedAt: now('updated_at').notNull(),
  },
  (t) => [check('app_settings_singleton', sql`${t.id} = 'global'`)]
);

export type AppSettings = typeof appSettings.$inferSelect;
export type NewAppSettings = typeof appSettings.$inferInsert;

// ============================================
// Scrape Jobs
// ============================================
export const scrapeJobs = sqliteTable(
  'scrape_jobs',
  {
    id: uuid('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['apify', 'treg'] }).notNull(),
    providerJobRef: text('provider_job_ref'),
    jobType: text('job_type').notNull(),
    inputSnapshot: text('input_snapshot', { mode: 'json' }).notNull(),
    status: text('status', { enum: ['pending', 'running', 'succeeded', 'failed'] })
      .notNull()
      .default('pending'),
    progress: integer('progress').notNull().default(0),
    resultCount: integer('result_count').notNull().default(0),
    errorMessage: text('error_message'),
    createdAt: now('created_at').notNull(),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
  },
  (t) => [
    index('idx_scrape_jobs_owner_id').on(t.ownerId),
    index('idx_scrape_jobs_status').on(t.status),
  ]
);

export type ScrapeJob = typeof scrapeJobs.$inferSelect;
export type NewScrapeJob = typeof scrapeJobs.$inferInsert;

export const scrapeJobItems = sqliteTable(
  'scrape_job_items',
  {
    jobId: text('job_id')
      .notNull()
      .references(() => scrapeJobs.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    data: text('data', { mode: 'json' }).notNull(),
    createdAt: now('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.idx] })]
);

export type ScrapeJobItem = typeof scrapeJobItems.$inferSelect;
export type NewScrapeJobItem = typeof scrapeJobItems.$inferInsert;

// ============================================
// Company Scrape History
// ============================================
export const companyScrapeHistory = sqliteTable(
  'company_scrape_history',
  {
    id: uuid('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    companyUrl: text('company_url').notNull(),
    maxItemsRequested: integer('max_items_requested').notNull(),
    itemsReturned: integer('items_returned').notNull(),
    itemsSaved: integer('items_saved').notNull(),
    scrapedAt: now('scraped_at').notNull(),
    filtersUsed: text('filters_used', { mode: 'json' }),
  },
  (t) => [index('idx_company_scrape_history_owner_company').on(t.ownerId, t.companyUrl)]
);

export type CompanyScrapeHistory = typeof companyScrapeHistory.$inferSelect;
export type NewCompanyScrapeHistory = typeof companyScrapeHistory.$inferInsert;
