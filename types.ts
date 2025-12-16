export interface LinkedInProfile {
  id?: string;
  created_at?: string;
  profile_url: string;
  full_name: string;

  // Basic identity
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  about?: string;
  photo_url?: string; // legacy UI field; may duplicate profile_pic_high_quality

  // Raw
  raw_data: any;
  ai_summary?: string;

  // Columns from the provided schema
  linkedin_public_url?: string;
  linkedin_id?: string;
  public_identifier?: string;
  connections?: number;
  followers?: number;
  email?: string;
  mobile_number?: string;
  address_country_only?: string;
  address_with_country?: string;
  address_without_country?: string;
  profile_pic?: string;
  profile_pic_high_quality?: string;
  background_pic?: string;
  is_premium?: boolean;
  is_verified?: boolean;
  is_job_seeker?: boolean;
  is_retired?: boolean;
  is_creator?: boolean;
  is_influencer?: boolean;
  is_currently_employed?: boolean;
  open_connection?: boolean;
  urn?: string;
  total_recommendations_received?: number;
  total_recommendations_given?: number;
  experiences_count?: number;

  // Current job
  job_title?: string;
  job_started_on?: string;
  job_location?: string;
  job_still_working?: boolean;
  company_name?: string;
  company_industry?: string;
  company_website?: string;
  company_linkedin?: string;
  company_founded_in?: number;
  company_size?: string;
  current_job_duration?: string;
  current_job_duration_years?: number;

  // Non-column convenience fields for UI
  experiences?: any[];
  education?: any[];
}

export interface ScraperState {
  isLoading: boolean;
  error: string | null;
  results: LinkedInProfile[];
}
