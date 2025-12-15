
import { createClient } from '@supabase/supabase-js';
import { LinkedInProfile } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

// Safely initialize the client or provide a null reference to prevent startup crashes
export const supabase = isSupabaseReady 
  ? createClient(supabaseUrl!, supabaseAnonKey!) 
  : null;

/**
 * SQL Schema for Supabase (Run this in your SQL Editor):
 * 
 * create table linkedin_profiles (
 *   id uuid default gen_random_uuid() primary key,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null,
 *   profile_url text unique not null,
 *   full_name text,
 *   headline text,
 *   location text,
 *   about text,
 *   photo_url text,
 *   raw_data jsonb,
 *   ai_summary text
 * );
 */

export const saveProfile = async (profile: LinkedInProfile) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  
  const { data, error } = await supabase
    .from('linkedin_profiles')
    .upsert(
      {
        profile_url: profile.profile_url,
        full_name: profile.full_name,
        headline: profile.headline,
        location: profile.location,
        about: profile.about,
        photo_url: profile.photo_url,
        raw_data: profile.raw_data,
        ai_summary: profile.ai_summary
      },
      { onConflict: 'profile_url' }
    )
    .select();

  if (error) throw error;
  return data;
};

export const fetchAllProfiles = async () => {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('linkedin_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as LinkedInProfile[];
};

export const deleteProfile = async (id: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  
  const { error } = await supabase
    .from('linkedin_profiles')
    .delete()
    .match({ id });

  if (error) throw error;
};

export const updateProfileAI = async (id: string, summary: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  
  const { error } = await supabase
    .from('linkedin_profiles')
    .update({ ai_summary: summary })
    .match({ id });

  if (error) throw error;
};
