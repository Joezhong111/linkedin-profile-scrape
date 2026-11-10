import { describe, expect, it } from 'vitest';
import { mergeNormalized, normalizeScrapeItem } from '../lib/normalize';
import apifyItem from './fixtures/apify-profile-item.json';
import harvestLead from './fixtures/harvestapi-lead.json';
import tregProfile from './fixtures/treg-profile.json';
import tregProfileEmail from './fixtures/treg-profile-email.json';
import tregProfileNoEmail from './fixtures/treg-profile-no-email.json';

describe('normalizeScrapeItem — Apify dev_fusion shape', () => {
  const profile = normalizeScrapeItem(apifyItem);

  it('maps identity, contact, and social fields', () => {
    expect(profile).toMatchObject({
      profile_url: 'https://www.linkedin.com/in/remi-ounadjela',
      linkedin_public_url: 'https://www.linkedin.com/in/remi-ounadjela',
      full_name: 'Remi Ounadjela',
      first_name: 'Remi',
      last_name: 'Ounadjela',
      headline: 'Senior Data Science Manager at TikTok',
      location: 'San Francisco Bay Area',
      about: 'Data science leader building trust & safety systems.',
      photo_url: 'https://media.licdn.com/dms/image/profile-pic-hq.jpg',
      email: 'remi.ounadjela@tiktok.com',
      mobile_number: '+1 415 555 0100',
      followers: 4231,
      connections: 500,
      linkedin_id: 'ACoAAA-kh3MBoBXafap6sJXgNKb6YBPwj12M-Bw',
      public_identifier: 'remi-ounadjela',
      urn: 'urn:li:fsd_profile:ACoAAA-kh3MBoBXafap6sJXgNKb6YBPwj12M-Bw',
      is_verified: true,
      is_premium: false,
      address_country_only: 'United States',
    });
  });

  it('maps the current job, company, experiences, and education', () => {
    expect(profile).toMatchObject({
      job_title: 'Senior Data Science Manager',
      job_started_on: 'Jan 2023',
      job_location: 'San Francisco Bay Area',
      job_still_working: true,
      company_name: 'TikTok',
      company_industry: 'Social Media',
      company_website: 'https://www.tiktok.com',
      company_linkedin: 'https://www.linkedin.com/company/tiktok',
      company_founded_in: 2016,
      company_size: '10,001+ employees',
      current_job_duration: '3 yrs 1 mo',
      current_job_duration_years: 3.08,
      experiences_count: 2,
    });
    expect(profile.experiences).toHaveLength(2);
    expect(profile.education).toHaveLength(1);
  });
});

describe('normalizeScrapeItem — HarvestAPI / treg shape', () => {
  const element = tregProfileEmail.element;

  it('maps the provider element including email arrays and parsed location', () => {
    expect(normalizeScrapeItem(element)).toMatchObject({
      profile_url: 'https://www.linkedin.com/in/remiounadjela',
      full_name: 'Rémi Ounadjela',
      first_name: 'Rémi',
      last_name: 'Ounadjela',
      headline: 'Data Science Manager @ TikTok | ex Google/Amazon',
      location: 'San Francisco Bay Area',
      address_with_country: 'San Francisco, CA, United States',
      address_country_only: 'United States of America',
      email: 'remi.ounadjela@tiktok.com',
      followers: 16183,
      connections: 11027,
      job_title: 'Senior Data Science Manager',
      company_name: 'TikTok',
      company_linkedin: 'https://www.linkedin.com/company/tiktok/',
      is_verified: true,
      is_premium: false,
    });
  });

  it('keeps experience/education and never invents a phone number', () => {
    const profile = normalizeScrapeItem(element);
    expect(profile.experiences).toHaveLength(2);
    expect(profile.education).toHaveLength(2);
    expect(profile.mobile_number).toBeUndefined();
  });

  it('treats a missing email as valid data rather than an error', () => {
    const profile = normalizeScrapeItem(tregProfileNoEmail.element);
    expect(profile.full_name).toBe('Rémi Ounadjela');
    expect(profile.email).toBeUndefined();
    expect(profile.mobile_number).toBeUndefined();
  });

  it.each([
    ['treg profile', tregProfile.element],
    ['treg profile email', tregProfileEmail.element],
    ['harvestapi lead', harvestLead],
  ])('normalizes the %s without throwing or a phone', (_label, payload) => {
    const profile = normalizeScrapeItem(payload);
    expect(profile.profile_url).toBeTruthy();
    expect(profile.full_name).toBeTruthy();
    expect(profile.mobile_number).toBeUndefined();
  });
});

describe('mergeNormalized', () => {
  it('never clears values already supplied by an earlier normalization', () => {
    const existing = normalizeScrapeItem(apifyItem);
    const sparse = normalizeScrapeItem({ profileUrl: apifyItem.profileUrl });
    const merged = mergeNormalized(existing, sparse);

    expect(merged.full_name).toBe(existing.full_name);
    expect(merged.headline).toBe(existing.headline);
    expect(merged.location).toBe(existing.location);
    expect(merged.email).toBe(existing.email);
    expect(merged.followers).toBe(existing.followers);
    expect(merged.connections).toBe(existing.connections);
    expect(merged.company_linkedin).toBe(existing.company_linkedin);
    expect(merged.experiences).toEqual(existing.experiences);
  });

  it('takes incoming values when they are present', () => {
    const existing: Record<string, unknown> = {
      full_name: 'Old Name',
      headline: 'Old',
      followers: 10,
    };
    const incoming: Record<string, unknown> = {
      full_name: 'New Name',
      headline: '',
      followers: undefined,
    };
    expect(mergeNormalized(existing, incoming)).toEqual({
      full_name: 'New Name',
      headline: 'Old',
      followers: 10,
    });
  });
});
