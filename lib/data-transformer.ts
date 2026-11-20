/**
 * ETL Transformer for LinkedIn Raw Data
 * Maps messy nested JSON to flat structures for Recharts
 */

/**
 * Provider payloads disagree on pluralization: Apify returns `experiences`
 * and `educations`, while HarvestAPI/treg returns `experience` and `education`.
 * Every visualization reads both so a saved row renders the same either way.
 */
export function getProfileExperiences(rawData: any): any[] {
  if (!rawData) return [];
  const experiences = rawData.experience ?? rawData.experiences;
  return Array.isArray(experiences) ? experiences : [];
}

export function getProfileEducation(rawData: any): any[] {
  if (!rawData) return [];
  const education = rawData.education ?? rawData.educations;
  return Array.isArray(education) ? education : [];
}

function yearFromDate(date: any): number | null {
  const value = date?.year ?? date?.text;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/(?:19|20)\d{2}/);
    return match ? parseInt(match[0], 10) : null;
  }
  return null;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

// ============================================
// Skills Transformation
// ============================================

export const transformSkillsData = (rawData: any) => {
  const skills = Array.isArray(rawData?.skills) ? rawData.skills : [];
  if (!skills.length) return [];

  return skills
    .map((skill: any) => {
      const name = skill.name || skill.title || 'Unknown';

      // Parse endorsements (e.g., "26 endorsements" -> 26)
      let value = 0;
      if (typeof skill.endorsements === 'string') {
        const match = skill.endorsements.match(/(\d+)/);
        if (match) value = parseInt(match[1]);
      } else if (typeof skill.endorsements === 'number') {
        value = skill.endorsements;
      }

      // Usage count (positions length or parse from text)
      let usageCount = 0;
      if (Array.isArray(skill.positions)) {
        // Check if positions is an array of strings like "16 experiences across..."
        const firstPosition = skill.positions[0];
        if (skill.positions.length > 0 && typeof firstPosition === 'string') {
          const match = firstPosition.match(/(\d+)\s+experiences?/);
          if (match?.[1]) usageCount = parseInt(match[1]);
        } else {
          usageCount = skill.positions.length;
        }
      }

      return {
        name,
        value,
        usage_count: usageCount,
        full_name: name,
      };
    })
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 15); // Top 15 skills
};

// Categorize skills into groups
export const transformSkillsByCategory = (rawData: any) => {
  if (!rawData || !rawData.skills) return { tech: [], business: [], marketing: [], other: [] };

  const categories: { tech: any[]; business: any[]; marketing: any[]; other: any[] } = {
    tech: [],
    business: [],
    marketing: [],
    other: [],
  };

  const techKeywords = [
    'AI',
    'Machine Learning',
    'Data Science',
    'Python',
    'SQL',
    'Big Data',
    'Analytics',
    'Visualization',
  ];
  const businessKeywords = [
    'Strategy',
    'Leadership',
    'Management',
    'Planning',
    'Development',
    'Operations',
  ];
  const marketingKeywords = [
    'Marketing',
    'SEO',
    'SEM',
    'Advertising',
    'Social Media',
    'Digital',
    'CRM',
  ];

  rawData.skills.forEach((skill: any) => {
    const name = skill.name || '';
    let value = 0;
    if (typeof skill.endorsements === 'string') {
      const match = skill.endorsements.match(/(\d+)/);
      if (match) value = parseInt(match[1]);
    }

    const item = { name, value };

    if (techKeywords.some((k) => name.includes(k))) {
      categories.tech.push(item);
    } else if (businessKeywords.some((k) => name.includes(k))) {
      categories.business.push(item);
    } else if (marketingKeywords.some((k) => name.includes(k))) {
      categories.marketing.push(item);
    } else {
      categories.other.push(item);
    }
  });

  return categories;
};

// ============================================
// Experience Transformation
// ============================================

export const transformExperienceData = (rawData: any) => {
  const experiences = getProfileExperiences(rawData);
  if (!experiences.length) return [];

  return experiences
    .map((exp: any) => {
      // Parse duration string to total months
      let totalMonths = 0;
      if (exp.duration) {
        const yearMatch = exp.duration.match(/(\d+)\s+yrs?/);
        const monthMatch = exp.duration.match(/(\d+)\s+mos?/);
        if (yearMatch) totalMonths += parseInt(yearMatch[1]) * 12;
        if (monthMatch) totalMonths += parseInt(monthMatch[1]);
      }

      // Format start date
      let startYear = null;
      let startMonth = null;
      if (exp.startDate) {
        startYear = exp.startDate.year;
        startMonth = exp.startDate.month;
      }

      // Check if current
      const isCurrent =
        !exp.endDate ||
        (typeof exp.endDate === 'object' && !exp.endDate.year) ||
        exp.endDate?.text === 'Present';

      return {
        name: exp.companyName || 'Unknown',
        value: totalMonths || 1,
        role: exp.position || exp.title || 'Unknown',
        startYear,
        startMonth,
        isCurrent,
        color: isCurrent ? '#3b82f6' : '#94a3b8',
        description: exp.description?.slice(0, 200) || null,
        skills: exp.skills || [],
      };
    })
    .sort((a: any, b: any) => {
      // Sort by start year descending (most recent first)
      if (a.startYear && b.startYear) {
        return b.startYear - a.startYear;
      }
      return 0;
    });
};

// For timeline visualization
export const transformExperienceTimeline = (rawData: any) => {
  const experiences = getProfileExperiences(rawData);
  if (!experiences.length) return [];

  return experiences
    .flatMap((exp: any) => {
      // Apify sends only `startDate.text` (e.g. "Jan 2023"); HarvestAPI also
      // sends `year`. Parse the text so both providers produce a timeline.
      const startYear = yearFromDate(exp.startDate);
      if (startYear === null) return [];

      const endYear = yearFromDate(exp.endDate);
      const isCurrent = endYear === null;
      const effectiveEnd = endYear ?? new Date().getFullYear();

      return [
        {
          company: exp.companyName || exp.company || 'Unknown',
          role: exp.position || exp.title || 'Unknown',
          start: startYear,
          end: effectiveEnd,
          startText: exp.startDate?.text || String(startYear),
          endText: exp.endDate?.text || (endYear === null ? 'Present' : String(endYear)),
          duration: exp.duration || `${effectiveEnd - startYear} yrs`,
          location: exp.location || exp.jobLocation || null,
          description: exp.description || null,
          isCurrent,
        },
      ];
    })
    .sort((a, b) => a.start - b.start);
};

// ============================================
// Languages Transformation (Radar Chart)
// ============================================

export const transformLanguagesData = (rawData: any) => {
  const languages = Array.isArray(rawData?.languages) ? rawData.languages : [];
  if (!languages.length) return [];

  const proficiencyMap: { [key: string]: number } = {
    'native or bilingual proficiency': 5,
    'full professional proficiency': 4,
    'professional working proficiency': 3,
    'limited working proficiency': 2,
    'elementary proficiency': 1,
  };

  return languages.map((lang: any) => {
    const proficiency = lang.proficiency?.toLowerCase() || '';
    let level = 3; // default

    for (const [key, value] of Object.entries(proficiencyMap)) {
      if (proficiency.includes(key.split(' ')[0])) {
        level = value;
        break;
      }
    }

    return {
      language: lang.name || 'Unknown',
      level,
      proficiency: lang.proficiency || 'Unknown',
      fullMark: 5,
    };
  });
};

// ============================================
// Certifications Transformation
// ============================================

export const transformCertificationsData = (rawData: any) => {
  if (!rawData || !rawData.certifications) return [];

  return rawData.certifications.map((cert: any) => {
    let year = null;
    if (cert.issuedAt) {
      const match = cert.issuedAt.match(/(\d{4})/);
      if (match) year = parseInt(match[1]);
    }

    return {
      name: cert.title || 'Unknown',
      issuer: cert.issuedBy || 'Unknown',
      year,
      logo: cert.issuedByLogo?.url || null,
    };
  });
};

// Group certifications by issuer for pie chart
export const transformCertsByIssuer = (rawData: any) => {
  if (!rawData || !rawData.certifications) return [];

  const issuerCount: { [key: string]: number } = {};

  rawData.certifications.forEach((cert: any) => {
    const issuer = cert.issuedBy || 'Unknown';
    issuerCount[issuer] = (issuerCount[issuer] || 0) + 1;
  });

  return Object.entries(issuerCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

// ============================================
// Patents Transformation
// ============================================

export const transformPatentsData = (rawData: any) => {
  if (!rawData || !rawData.patents) return [];

  return rawData.patents.map((patent: any) => ({
    title: patent.title || 'Unknown',
    number: patent.number || null,
  }));
};

// ============================================
// Education Transformation
// ============================================

export const transformEducationData = (rawData: any) => {
  const education = rawData?.education || rawData?.educations || [];

  return education.map((edu: any) => {
    let gpa = null;
    if (edu.insights) {
      const match = edu.insights.match(/Grade:\s*([\d.]+)/);
      if (match) gpa = parseFloat(match[1]);
    }

    return {
      school: edu.schoolName || 'Unknown',
      degree: edu.degree || 'Unknown',
      fieldOfStudy: edu.fieldOfStudy || null,
      gpa,
      logo: edu.schoolLogo?.url || null,
      skills: edu.skills || [],
    };
  });
};

// ============================================
// Volunteering Transformation
// ============================================

export const transformVolunteeringData = (rawData: any) => {
  if (!rawData || !rawData.volunteering) return [];

  return rawData.volunteering.map((vol: any) => ({
    role: vol.role || 'Unknown',
    organization: vol.organizationName || 'Unknown',
    cause: vol.cause || null,
  }));
};

// ============================================
// Recommendations Transformation
// ============================================

export const transformRecommendationsData = (rawData: any) => {
  if (!rawData || !rawData.receivedRecommendations) return [];

  return rawData.receivedRecommendations.map((rec: any) => {
    // Parse date from "November 9, 2015, Rubria worked with..."
    let date = null;
    if (rec.givenAt) {
      const match = rec.givenAt.match(/^([A-Za-z]+\s+\d+,\s+\d{4})/);
      if (match) date = match[1];
    }

    return {
      givenBy: rec.givenBy || 'Unknown',
      headline: rec.givenByHeadline || null,
      photo: rec.givenByPicture?.url || null,
      excerpt: rec.description?.slice(0, 250) + (rec.description?.length > 250 ? '...' : '') || '',
      date,
    };
  });
};

// ============================================
// Featured Items Transformation
// ============================================

export const transformFeaturedData = (rawData: any) => {
  if (!rawData || !rawData.featured?.slides) return [];

  return rawData.featured.slides.map((slide: any) => ({
    title: slide.title || 'Untitled',
    description: slide.description || null,
    image: slide.image?.url || null,
    url: slide.url || null,
  }));
};

// ============================================
// Summary Stats
// ============================================

export const getProfileStats = (rawData: any) => {
  return {
    skillsCount: arrayLength(rawData?.skills),
    experienceCount: getProfileExperiences(rawData).length,
    languagesCount: arrayLength(rawData?.languages),
    certificationsCount: arrayLength(rawData?.certifications),
    patentsCount: arrayLength(rawData?.patents),
    recommendationsCount: arrayLength(rawData?.receivedRecommendations),
    followers: rawData?.followerCount ?? rawData?.followers ?? 0,
    connections: rawData?.connectionsCount ?? rawData?.connections ?? 0,
  };
};

/**
 * Sums the provider duration strings ("3 yrs 1 mo"). Summing roles is a
 * deliberate approximation: overlapping roles count twice, but the header
 * previously showed 0 for every HarvestAPI/treg profile.
 */
export const getTotalExperienceYears = (rawData: any): number => {
  const months = transformExperienceData(rawData).reduce(
    (total, experience: any) => total + (Number(experience.value) || 0),
    0
  );
  return Math.round((months / 12) * 10) / 10;
};
