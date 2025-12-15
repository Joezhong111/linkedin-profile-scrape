
export interface LinkedInProfile {
  id?: string;
  created_at?: string;
  profile_url: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  about?: string;
  photo_url?: string;
  experiences?: any[];
  education?: any[];
  raw_data: any;
  ai_summary?: string;
}

export interface ScraperState {
  isLoading: boolean;
  error: string | null;
  results: LinkedInProfile[];
}
