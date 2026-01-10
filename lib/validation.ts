import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().min(1, 'Full name is required').optional(),
});

export const profileUrlSchema = z.object({
  profile_url: z
    .string()
    .url('Invalid LinkedIn profile URL')
    .refine((url) => url.includes('linkedin.com/in/'), 'URL must be a LinkedIn profile'),
});

export const saveProfileSchema = profileUrlSchema.extend({
  owner_id: z.string().uuid('Invalid user ID'),
  raw_data: z.any().optional(),
  ai_summary: z.string().optional(),
  about: z.string().optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  connections: z.number().int().optional(),
  followers: z.number().int().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  mobile_number: z.string().optional(),
  job_title: z.string().optional(),
  company_name: z.string().optional(),
  company_industry: z.string().optional(),
  company_website: z.string().url().optional().or(z.literal('')),
  company_linkedin: z.string().url().optional().or(z.literal('')),
  company_founded_in: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  company_size: z.string().optional(),
  current_job_duration: z.string().optional(),
  current_job_duration_years: z.number().optional(),
  is_premium: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  is_job_seeker: z.boolean().optional(),
  is_retired: z.boolean().optional(),
  is_creator: z.boolean().optional(),
  is_influencer: z.boolean().optional(),
  is_currently_employed: z.boolean().optional(),
  open_connection: z.boolean().optional(),
  linkedin_public_url: z.string().url().optional().or(z.literal('')),
  linkedin_id: z.string().optional(),
  public_identifier: z.string().optional(),
  profile_pic: z.string().url().optional().or(z.literal('')),
  profile_pic_high_quality: z.string().url().optional().or(z.literal('')),
  background_pic: z.string().url().optional().or(z.literal('')),
  urn: z.string().optional(),
  total_recommendations_received: z.number().int().optional(),
  total_recommendations_given: z.number().int().optional(),
  experiences_count: z.number().int().optional(),
  job_started_on: z.string().optional(),
  job_location: z.string().optional(),
  job_still_working: z.boolean().optional(),
  address_country_only: z.string().optional(),
  address_with_country: z.string().optional(),
  address_without_country: z.string().optional(),
});

export const scrapeUrlsSchema = z.object({
  urls: z
    .array(z.string().url('Invalid URL'))
    .min(1, 'At least one URL is required')
    .max(10, 'Maximum 10 URLs allowed')
    .refine(
      (urls) => urls.every((url) => url.includes('linkedin.com/in/')),
      'All URLs must be LinkedIn profiles'
    ),
});

export const scrapeCompanySchema = z.object({
  companyUrl: z
    .string()
    .url('Invalid company URL')
    .refine((url) => url.includes('linkedin.com/company/'), 'URL must be a LinkedIn company'),
  maxItems: z.number().int().min(1).max(100).default(25),
  profileScraperMode: z.enum(['full-profile', 'lite-profile']).default('full-profile'),
  jobTitles: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  yearsAtCurrentCompanyIds: z.array(z.string()).optional(),
  yearsOfExperienceIds: z.array(z.string()).optional(),
});

export const setQuotaSchema = z.object({
  email: z.string().email('Invalid email'),
  monthly_limit: z.number().int().min(0, 'Monthly limit must be non-negative'),
});

export const createQuotaSchema = setQuotaSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  invite: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SaveProfileInput = z.infer<typeof saveProfileSchema>;
export type ScrapeUrlsInput = z.infer<typeof scrapeUrlsSchema>;
export type ScrapeCompanyInput = z.infer<typeof scrapeCompanySchema>;
export type SetQuotaInput = z.infer<typeof setQuotaSchema>;
export type CreateQuotaInput = z.infer<typeof createQuotaSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
