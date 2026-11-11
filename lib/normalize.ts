import type { LinkedInProfile } from '../types';

/**
 * Pure normalization shared by the Worker and the SPA.
 *
 * Provider payloads (Apify dev_fusion profiles, HarvestAPI/treg profiles and
 * leads) all become the snake_case client shape from `types.ts`. Aliases are
 * checked in order; the first non-empty value wins and a missing alias never
 * clears a value another alias supplied.
 *
 * No env, DOM, or network imports here on purpose.
 */

type UnknownRecord = Record<string, unknown>;

/**
 * Lower-cased, query-free, slash-free URL used only as a dedupe key. It is not
 * a display value; callers keep the original URL for the wire shape.
 */
export function normalizeProfileUrl(url: string): string {
  return url.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const str = asString(value);
    if (str !== undefined) return str;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return undefined;
    const parsed = Number(cleaned.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = asNumber(value);
    if (num !== undefined) return num;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function pickBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    const bool = asBoolean(value);
    if (bool !== undefined) return bool;
  }
  return undefined;
}

function recordArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function nested(record: UnknownRecord | undefined, key: string): UnknownRecord | undefined {
  if (!record) return undefined;
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function nestedString(record: UnknownRecord | undefined, key: string): string | undefined {
  if (!record) return undefined;
  return asString(record[key]);
}

/** HarvestAPI/treg place the email in `emails[]`, preferring a valid address. */
function pickEmail(raw: UnknownRecord): string | undefined {
  const direct = pickString(raw.email, raw.emailAddress);
  if (direct) return direct;

  const emails = recordArray(raw.emails);
  const valid = emails.find(
    (entry) => asString(entry.status)?.toLowerCase() === 'valid' && asString(entry.email)
  );
  const fallback = emails.find((entry) => asString(entry.email));
  return asString((valid ?? fallback)?.email);
}

function pickLocation(raw: UnknownRecord): {
  location?: string;
  countryOnly?: string;
  withCountry?: string;
  withoutCountry?: string;
} {
  const location = raw.location;
  const locationRecord = isRecord(location) ? location : undefined;
  const parsed = nested(locationRecord, 'parsed');

  const locationText = pickString(
    typeof location === 'string' ? location : undefined,
    nestedString(locationRecord, 'linkedinText'),
    nestedString(parsed, 'text')
  );

  const city = nestedString(parsed, 'city');
  const state = nestedString(parsed, 'state');
  const cityState = city ? (state ? `${city}, ${state}` : city) : undefined;

  return {
    location: locationText,
    countryOnly: pickString(
      raw.addressCountryOnly,
      raw.address_country_only,
      nestedString(parsed, 'countryFull'),
      nestedString(parsed, 'country')
    ),
    withCountry: pickString(
      raw.addressWithCountry,
      raw.address_with_country,
      nestedString(parsed, 'text')
    ),
    withoutCountry: pickString(
      raw.addressWithoutCountry,
      raw.address_without_country,
      cityState
    ),
  };
}

export function normalizeScrapeItem(raw: unknown): LinkedInProfile {
  const item: UnknownRecord = isRecord(raw) ? raw : {};

  const firstName = pickString(item.firstName, item.first_name);
  const lastName = pickString(item.lastName, item.last_name);
  const joinedName = [firstName, lastName].filter(Boolean).join(' ');
  const fullName = pickString(item.fullName, item.full_name, joinedName) ?? '';

  const location = pickLocation(item);
  const photo = pickString(
    item.photo,
    item.profilePicHighQuality,
    item.profile_pic_high_quality,
    item.profilePic,
    item.profile_pic,
    item.pictureUrl,
    nestedString(nested(item, 'profilePicture'), 'url')
  );

  const currentPositions = recordArray(
    item.currentPosition ?? item.currentPositions ?? item.current_position
  );
  const currentPosition = currentPositions[0];
  const experiences = recordArray(item.experience ?? item.experiences);
  const firstExperience = experiences[0];
  const education = recordArray(item.education ?? item.educations);

  const experienceStart = nestedString(nested(firstExperience, 'startDate'), 'text');
  const experienceEnd = nestedString(nested(firstExperience, 'endDate'), 'text');
  const jobPeriod =
    pickString(item.jobPeriod, item.job_period) ??
    (firstExperience
      ? [experienceStart, experienceEnd].filter(Boolean).join(' - ') || undefined
      : undefined);

  let jobStillWorking = pickBoolean(item.jobStillWorking, item.job_still_working);
  if (jobStillWorking === undefined && currentPosition) {
    const dateRange = nested(currentPosition, 'dateRange');
    if (dateRange) jobStillWorking = dateRange.end === null || dateRange.end === undefined;
  }
  if (jobStillWorking === undefined && firstExperience) {
    const endDate = firstExperience.endDate;
    jobStillWorking =
      endDate === null || endDate === undefined
        ? true
        : experienceEnd?.toLowerCase() === 'present' || false;
  }

  const profileUrl =
    pickString(item.profileUrl, item.linkedinUrl, item.linkedinPublicUrl, item.url, item.profile_url) ??
    '';
  const linkedinPublicUrl = pickString(
    item.linkedinPublicUrl,
    item.linkedin_public_url,
    item.linkedinUrl,
    item.profileUrl,
    item.url,
    item.profile_url
  );

  return {
    profile_url: profileUrl,
    linkedin_public_url: linkedinPublicUrl,

    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    headline: pickString(item.headline, item.title),
    location: location.location,
    about: pickString(item.about, item.summary),
    photo_url: photo,

    linkedin_id: pickString(item.linkedinId, item.linkedin_id, item.id),
    public_identifier: pickString(item.publicIdentifier, item.public_identifier),
    urn: pickString(item.urn, item.objectUrn, item.object_urn),

    email: pickEmail(item),
    mobile_number: pickString(item.mobileNumber, item.mobile_number, item.phone),
    followers: pickNumber(item.followers, item.followerCount, item.follower_count),
    connections: pickNumber(item.connections, item.connectionsCount, item.connections_count),

    address_country_only: location.countryOnly,
    address_with_country: location.withCountry,
    address_without_country: location.withoutCountry,

    profile_pic: pickString(
      item.profilePic,
      item.profile_pic,
      nestedString(nested(item, 'profilePicture'), 'url'),
      item.photo
    ),
    profile_pic_high_quality: pickString(
      item.profilePicHighQuality,
      item.profile_pic_high_quality,
      nestedString(nested(item, 'profilePicture'), 'url'),
      item.photo
    ),
    background_pic: pickString(
      item.backgroundPic,
      item.background_pic,
      nestedString(nested(item, 'coverPicture'), 'url')
    ),

    is_premium: pickBoolean(item.isPremium, item.is_premium, item.premium),
    is_verified: pickBoolean(item.isVerified, item.is_verified, item.verified),
    is_job_seeker: pickBoolean(item.isJobSeeker, item.is_job_seeker, item.openToWork),
    is_retired: pickBoolean(item.isRetired, item.is_retired),
    is_creator: pickBoolean(item.isCreator, item.is_creator),
    is_influencer: pickBoolean(item.isInfluencer, item.is_influencer, item.influencer),
    is_currently_employed: pickBoolean(item.isCurrentlyEmployed, item.is_currently_employed),
    open_connection: pickBoolean(item.openConnection, item.open_connection),

    total_recommendations_received: pickNumber(
      item.totalRecommendationsReceived,
      item.total_recommendations_received
    ),
    total_recommendations_given: pickNumber(
      item.totalRecommendationsGiven,
      item.total_recommendations_given
    ),
    experiences_count:
      pickNumber(item.experiencesCount, item.experiences_count) ??
      (experiences.length > 0 ? experiences.length : undefined),

    job_title: pickString(
      item.jobTitle,
      item.job_title,
      nestedString(currentPosition, 'title'),
      nestedString(currentPosition, 'position'),
      nestedString(firstExperience, 'position'),
      nestedString(firstExperience, 'title')
    ),
    job_started_on: pickString(
      item.jobStartedOn,
      item.job_started_on,
      experienceStart,
      nestedString(nested(currentPosition, 'dateRange'), 'start')
    ),
    job_location: pickString(
      item.jobLocation,
      item.job_location,
      nestedString(firstExperience, 'location'),
      nestedString(currentPosition, 'location')
    ),
    job_still_working: jobStillWorking,
    job_period: jobPeriod,

    company_name: pickString(
      item.companyName,
      item.company_name,
      nestedString(currentPosition, 'companyName'),
      nestedString(firstExperience, 'companyName')
    ),
    company_industry: pickString(
      item.companyIndustry,
      item.company_industry,
      nestedString(firstExperience, 'companyIndustry')
    ),
    company_website: pickString(
      item.companyWebsite,
      item.company_website,
      nestedString(firstExperience, 'companyWebsite')
    ),
    company_linkedin: pickString(
      item.companyLinkedin,
      item.company_linkedin,
      nestedString(firstExperience, 'companyLinkedinUrl'),
      nestedString(currentPosition, 'companyLinkedinUrl')
    ),
    company_founded_in: pickNumber(item.companyFoundedIn, item.company_founded_in),
    company_size: pickString(item.companySize, item.company_size),
    current_job_duration: pickString(
      item.currentJobDuration,
      item.current_job_duration,
      nestedString(firstExperience, 'duration')
    ),
    current_job_duration_years: pickNumber(
      item.currentJobDurationInYrs,
      item.currentJobDurationYears,
      item.current_job_duration_years,
      item.current_job_duration_years
    ),

    ai_summary: pickString(item.aiSummary, item.ai_summary),

    experiences,
    education,
    raw_data: raw,
  };
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/**
 * Shallow merge that never lets an incoming null/undefined/empty value clear a
 * value already present in `existing`.
 */
export function mergeNormalized<T>(existing: T | undefined, incoming: T): T {
  if (existing === undefined || existing === null) {
    return { ...(incoming as object) } as T;
  }
  if (typeof existing !== 'object' || existing === null) return incoming;

  const merged: UnknownRecord = { ...(existing as UnknownRecord) };
  for (const [key, value] of Object.entries(incoming as UnknownRecord)) {
    if (!isEmptyValue(value)) merged[key] = value;
  }
  return merged as T;
}
