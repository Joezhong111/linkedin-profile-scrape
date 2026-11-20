import { describe, expect, it } from 'vitest';
import apifyItem from './fixtures/apify-profile-item.json';
import tregProfile from './fixtures/treg-profile.json';
import {
  getProfileEducation,
  getProfileExperiences,
  getProfileStats,
  getTotalExperienceYears,
  transformExperienceTimeline,
  transformLanguagesData,
  transformSkillsData,
} from '../lib/data-transformer';

const treg = tregProfile.element;

describe('provider-agnostic profile lists', () => {
  it('reads HarvestAPI/treg singular keys', () => {
    expect(getProfileExperiences(treg)).toHaveLength(2);
    expect(getProfileEducation(treg)).toHaveLength(2);
  });

  it('reads Apify plural keys', () => {
    expect(getProfileExperiences(apifyItem)).toHaveLength(2);
    expect(getProfileEducation(apifyItem)).toHaveLength(1);
  });
});

describe('transformExperienceTimeline', () => {
  it('builds a timeline from HarvestAPI/treg year fields', () => {
    const timeline = transformExperienceTimeline(treg);
    expect(timeline).toHaveLength(2);

    const current = timeline.find((entry) => entry.isCurrent);
    expect(current).toMatchObject({
      company: 'TikTok',
      role: 'Senior Data Science Manager',
      start: 2023,
      startText: 'Jan 2023',
      endText: 'Present',
      location: 'San Francisco Bay Area',
    });
    expect(current?.end).toBe(new Date().getFullYear());

    const previous = timeline.find((entry) => entry.start === 2020);
    expect(previous).toMatchObject({
      company: 'TikTok',
      role: 'Data Science Manager',
      start: 2020,
      end: 2023,
      startText: 'Nov 2020',
      endText: 'Jan 2023',
      isCurrent: false,
    });
  });

  it('parses Apify dates that only carry text', () => {
    const timeline = transformExperienceTimeline(apifyItem);
    expect(timeline).toHaveLength(2);

    const current = timeline.find((entry) => entry.isCurrent);
    expect(current).toMatchObject({
      company: 'TikTok',
      role: 'Senior Data Science Manager',
      start: 2023,
      startText: 'Jan 2023',
      endText: 'Present',
    });

    const previous = timeline.find((entry) => entry.start === 2019);
    expect(previous).toMatchObject({
      company: 'Meta',
      role: 'Data Scientist',
      end: 2022,
      isCurrent: false,
    });
  });
});

describe('provider-agnostic aggregates', () => {
  it('renders treg skills and languages', () => {
    expect(transformSkillsData(treg)).toEqual([
      expect.objectContaining({ name: 'Python', value: 29 }),
    ]);
    expect(transformLanguagesData(treg)).toHaveLength(1);
  });

  it('counts experience for both provider shapes', () => {
    expect(getProfileStats(treg)).toMatchObject({
      skillsCount: 1,
      experienceCount: 2,
      languagesCount: 1,
      followers: 16183,
      connections: 11027,
    });
    expect(getProfileStats(apifyItem).experienceCount).toBe(2);
    expect(getProfileStats(apifyItem).followers).toBe(apifyItem.followers);
  });

  it('estimates total experience years from duration strings', () => {
    expect(getTotalExperienceYears(treg)).toBeGreaterThan(0);
    expect(getTotalExperienceYears(apifyItem)).toBeGreaterThan(0);
    expect(getTotalExperienceYears({})).toBe(0);
  });
});
