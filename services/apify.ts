
import * as ApifyModule from 'apify-client';
import { LinkedInProfile } from '../types';

// Robustly extract ApifyClient from the module, handling various ESM transformation styles
const ApifyClient = (ApifyModule as any).ApifyClient || (ApifyModule as any).default?.ApifyClient || (ApifyModule as any).default;

const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

export const scrapeLinkedInProfiles = async (urls: string[]): Promise<LinkedInProfile[]> => {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is missing in environment variables.');
  }

  if (!ApifyClient) {
    throw new Error('Failed to load ApifyClient from module. Check your connection or package version.');
  }

  const client = new ApifyClient({
    token: APIFY_TOKEN,
  });

  const input = {
    "profileUrls": urls
  };

  try {
    // Run the Actor and wait for it to finish
    // Actor ID: 2SyF0bVxmgGr8IVCZ (LinkedIn Profile Scraper)
    const run = await client.actor("2SyF0bVxmgGr8IVCZ").call(input);

    // Fetch Actor results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    return items.map((item: any) => ({
      profile_url: item.url || item.profileUrl || urls[0],
      full_name: item.fullName || `${item.firstName} ${item.lastName}` || 'Unknown',
      headline: item.headline || item.title || '',
      location: item.location || '',
      about: item.about || item.summary || '',
      photo_url: item.profilePicUrl || item.profilePhotoUrl || '',
      raw_data: item,
    }));
  } catch (error: any) {
    console.error('Apify scraping failed:', error);
    throw new Error(error.message || 'Scraping failed');
  }
};
