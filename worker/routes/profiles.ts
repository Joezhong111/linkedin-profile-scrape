import { and, desc, eq } from 'drizzle-orm';
import { linkedinProfiles, type NewLinkedInProfile } from '../../db/schema';
import { mergeNormalized, normalizeScrapeItem } from '../../lib/normalize';
import type { LinkedInProfile } from '../../types';
import { createDb, type AppDb } from '../db';
import { error, json, parseJsonBody, requireUser, type Route } from '../http';
import { mapProfileRow } from '../mappers';

type ProfileColumnValues = Omit<NewLinkedInProfile, 'id' | 'createdAt' | 'ownerId'>;

function nullable(value: string | undefined | null): string | null {
  return value ? value : null;
}

function profileColumns(profile: LinkedInProfile): ProfileColumnValues {
  return {
    profileUrl: profile.profile_url,
    fullName: nullable(profile.full_name),
    headline: nullable(profile.headline),
    location: nullable(profile.location),
    about: nullable(profile.about),
    photoUrl: nullable(profile.photo_url),
    rawData: profile.raw_data ?? null,
    aiSummary: nullable(profile.ai_summary),
    linkedinPublicUrl: nullable(profile.linkedin_public_url),
    linkedinId: nullable(profile.linkedin_id),
    publicIdentifier: nullable(profile.public_identifier),
    firstName: nullable(profile.first_name),
    lastName: nullable(profile.last_name),
    connections: profile.connections ?? null,
    followers: profile.followers ?? null,
    email: nullable(profile.email),
    mobileNumber: nullable(profile.mobile_number),
    addressCountryOnly: nullable(profile.address_country_only),
    addressWithCountry: nullable(profile.address_with_country),
    addressWithoutCountry: nullable(profile.address_without_country),
    profilePic: nullable(profile.profile_pic),
    profilePicHighQuality: nullable(profile.profile_pic_high_quality),
    backgroundPic: nullable(profile.background_pic),
    isPremium: profile.is_premium ?? null,
    isVerified: profile.is_verified ?? null,
    isJobSeeker: profile.is_job_seeker ?? null,
    isRetired: profile.is_retired ?? null,
    isCreator: profile.is_creator ?? null,
    isInfluencer: profile.is_influencer ?? null,
    isCurrentlyEmployed: profile.is_currently_employed ?? null,
    openConnection: profile.open_connection ?? null,
    urn: nullable(profile.urn),
    totalRecommendationsReceived: profile.total_recommendations_received ?? null,
    totalRecommendationsGiven: profile.total_recommendations_given ?? null,
    experiencesCount: profile.experiences_count ?? null,
    jobTitle: nullable(profile.job_title),
    jobStartedOn: nullable(profile.job_started_on),
    jobLocation: nullable(profile.job_location),
    jobStillWorking: profile.job_still_working ?? null,
    companyName: nullable(profile.company_name),
    companyIndustry: nullable(profile.company_industry),
    companyWebsite: nullable(profile.company_website),
    companyLinkedin: nullable(profile.company_linkedin),
    companyFoundedIn: profile.company_founded_in ?? null,
    companySize: nullable(profile.company_size),
    currentJobDuration: nullable(profile.current_job_duration),
    currentJobDurationYears: profile.current_job_duration_years ?? null,
  };
}

function incomingProfile(body: Record<string, unknown>): LinkedInProfile {
  const rawData = body.raw_data ?? {};
  const fromRaw = normalizeScrapeItem(rawData);

  // Saved-row metadata (id/owner/timestamp) is not provider data; keeping it
  // would let a row id masquerade as a LinkedIn id on re-save.
  const clientFields: Record<string, unknown> = { ...body };
  delete clientFields.id;
  delete clientFields.owner_id;
  delete clientFields.created_at;

  const fromBody = normalizeScrapeItem(clientFields);
  const merged = mergeNormalized(fromRaw, fromBody);
  merged.raw_data = rawData;
  return merged;
}

async function findOwnedProfile(db: AppDb, ownerId: string, profileUrl: string) {
  const [row] = await db
    .select()
    .from(linkedinProfiles)
    .where(
      and(eq(linkedinProfiles.ownerId, ownerId), eq(linkedinProfiles.profileUrl, profileUrl))
    )
    .limit(1);
  return row;
}

export const profilesRoutes: Route[] = [
  {
    method: 'GET',
    path: '/api/profiles/list',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const rows = await createDb(ctx.env.DB)
        .select()
        .from(linkedinProfiles)
        .where(eq(linkedinProfiles.ownerId, user.id))
        .orderBy(desc(linkedinProfiles.createdAt), desc(linkedinProfiles.id));

      return json(rows.map(mapProfileRow));
    },
  },
  {
    method: 'POST',
    path: '/api/profiles/save',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const body = await parseJsonBody(ctx.request);
      const profileUrl = typeof body.profile_url === 'string' ? body.profile_url.trim() : '';
      if (!profileUrl) return error(400, 'profile_url is required');

      const db = createDb(ctx.env.DB);
      const incoming = incomingProfile(body);
      incoming.profile_url = profileUrl;

      const existing = await findOwnedProfile(db, user.id, profileUrl);
      const columns = profileColumns(
        existing
          // The mapped row has nullable columns where the client type is strict.
          ? mergeNormalized(
              mapProfileRow(existing) as unknown as LinkedInProfile,
              incoming
            )
          : incoming
      );

      if (existing) {
        const [updated] = await db
          .update(linkedinProfiles)
          .set(columns)
          .where(
            and(eq(linkedinProfiles.id, existing.id), eq(linkedinProfiles.ownerId, user.id))
          )
          .returning();
        return json(mapProfileRow(updated ?? existing));
      }

      const [inserted] = await db
        .insert(linkedinProfiles)
        .values({ ownerId: user.id, ...columns })
        .returning();
      if (!inserted) return error(500, 'Failed to save profile');
      return json(mapProfileRow(inserted));
    },
  },
  {
    method: 'POST',
    path: '/api/profiles/delete',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const body = await parseJsonBody(ctx.request);
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) return error(400, 'id is required');

      await createDb(ctx.env.DB)
        .delete(linkedinProfiles)
        .where(and(eq(linkedinProfiles.id, id), eq(linkedinProfiles.ownerId, user.id)));

      return json({ success: true });
    },
  },
  {
    method: 'POST',
    path: '/api/profiles/update-ai',
    handler: async (ctx) => {
      const user = await requireUser(ctx);
      if (user instanceof Response) return user;

      const body = await parseJsonBody(ctx.request);
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const summary = body.ai_summary;
      if (!id) return error(400, 'id is required');
      if (typeof summary !== 'string') return error(400, 'ai_summary is required');

      await createDb(ctx.env.DB)
        .update(linkedinProfiles)
        .set({ aiSummary: summary })
        .where(and(eq(linkedinProfiles.id, id), eq(linkedinProfiles.ownerId, user.id)));

      return json({ success: true });
    },
  },
];
