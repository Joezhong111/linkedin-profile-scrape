/**
 * ETL Transformer for LinkedIn Raw Data
 * Maps messy nested JSON to flat structures for Recharts
 */

export const transformSkillsData = (rawData: any) => {
    if (!rawData || !rawData.skills) return [];

    return rawData.skills.map((skill: any) => {
        // 1. Extract name
        const name = skill.name || "Unknown";

        // 2. Parse endorsements (e.g., "26 endorsements" -> 26)
        let value = 0;
        if (typeof skill.endorsements === 'string') {
            const match = skill.endorsements.match(/(\d+)/);
            if (match) value = parseInt(match[1]);
        } else if (typeof skill.endorsements === 'number') {
            value = skill.endorsements;
        }

        // 3. Usage count (positions length)
        const usageCount = Array.isArray(skill.positions) ? skill.positions.length : 0;

        return {
            name,
            value,
            usage_count: usageCount,
            full_name: name // for tooltips
        };
    }).sort((a: any, b: any) => b.value - a.value).slice(0, 10); // Top 10 skills
};

export const transformExperienceData = (rawData: any) => {
    const experiences = rawData.experience || rawData.experiences || [];
    if (!experiences.length) return [];

    return experiences.map((exp: any) => {
        // 1. Parse duration string to total months
        let totalMonths = 0;
        if (exp.duration) {
            const yearMatch = exp.duration.match(/(\d+)\s+yrs?/);
            const monthMatch = exp.duration.match(/(\d+)\s+mos?/);
            if (yearMatch) totalMonths += parseInt(yearMatch[1]) * 12;
            if (monthMatch) totalMonths += parseInt(monthMatch[1]);
        }

        // 2. Format start date
        let startDateStr = "Unknown";
        if (exp.startDate && exp.startDate.year) {
            const month = exp.startDate.month ? String(exp.startDate.month).padStart(2, '0') : '01';
            startDateStr = `${exp.startDate.year}-${month}`;
        }

        // 3. Check if current
        const isCurrent = !exp.endDate ||
            (typeof exp.endDate === 'object' && !exp.endDate.year) ||
            (typeof exp.endDate === 'string' && exp.endDate.toLowerCase().includes("present")) ||
            (exp.endDate.text && exp.endDate.text === "Present");

        return {
            name: exp.companyName || "Unknown",
            value: totalMonths || 1, // Minimum 1 for visibility in charts
            role: exp.position || exp.title || "Unknown",
            startDate: startDateStr,
            isCurrent,
            color: isCurrent ? "#3b82f6" : "#94a3b8"
        };
    }).sort((a: any, b: any) => b.value - a.value);
};

export const transformEducationData = (rawData: any) => {
    const education = rawData.education || rawData.educations || [];
    return education.map((edu: any) => {
        let gpa = null;
        if (edu.insights) {
            const match = edu.insights.match(/Grade:\s*([\d.]+)/);
            if (match) gpa = parseFloat(match[1]);
        }
        return {
            school: edu.schoolName || "Unknown",
            degree: edu.degree || "Unknown",
            gpa,
            year: edu.endDate?.year || null
        };
    });
};

export const transformCertificationsData = (rawData: any) => {
    const certs = rawData.certifications || [];
    return certs.map((cert: any) => {
        let year = null;
        if (cert.issuedAt) {
            const match = cert.issuedAt.match(/(\d{4})/);
            if (match) year = parseInt(match[1]);
        }
        return {
            name: cert.title || "Unknown",
            year
        };
    });
};
