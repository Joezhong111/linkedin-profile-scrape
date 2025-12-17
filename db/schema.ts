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

// Use default Postgres schema (public)
export const linkedinProfiles = pgTable(
  "linkedin_profiles",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),

    // Owner (Supabase auth.users.id) - initially nullable to allow safe migration/backfill
    ownerId: uuid("owner_id"),

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

export type LinkedInProfile = typeof linkedinProfiles.$inferSelect;
export type NewLinkedInProfile = typeof linkedinProfiles.$inferInsert;
