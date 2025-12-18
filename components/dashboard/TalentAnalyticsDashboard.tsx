import React from "react";
import { LinkedInProfile } from "../../types";
import ProfileHeader from "./ProfileHeader";
import AboutSection from "./AboutSection";
import SkillsSection from "./SkillsSection";
import CareerTimeline from "./CareerTimeline";
import NetworkTreemap from "./NetworkTreemap";

interface TalentAnalyticsDashboardProps {
  profile: LinkedInProfile;
}

const TalentAnalyticsDashboard: React.FC<TalentAnalyticsDashboardProps> = ({
  profile,
}) => {
  const rd0: any = (profile as any).raw_data || {};

  // Build a resilient view-model by merging flat columns as fallback
  const rd: any = {
    // identity
    fullName:
      rd0.fullName ||
      (profile as any).full_name ||
      [
        rd0.firstName || (profile as any).first_name,
        rd0.lastName || (profile as any).last_name,
      ]
        .filter(Boolean)
        .join(" "),
    headline: rd0.headline || (profile as any).headline,
    addressWithCountry:
      rd0.addressWithCountry ||
      (profile as any).address_with_country ||
      (profile as any).location,

    // media
    profilePicHighQuality:
      rd0.profilePicHighQuality ||
      (profile as any).profile_pic_high_quality ||
      rd0.profilePic ||
      (profile as any).photo_url,
    backgroundPic: rd0.backgroundPic || (profile as any).background_pic,

    // contacts
    email: rd0.email || (profile as any).email,
    mobileNumber: rd0.mobileNumber || (profile as any).mobile_number,

    // company/job snapshot
    companyName: rd0.companyName || (profile as any).company_name,
    companyWebsite: rd0.companyWebsite || (profile as any).company_website,
    companyLinkedin: rd0.companyLinkedin || (profile as any).company_linkedin,
    companyIndustry: rd0.companyIndustry || (profile as any).company_industry,

    // numbers
    followers: rd0.followers ?? (profile as any).followers ?? 0,
    connections: rd0.connections ?? (profile as any).connections ?? 0,
    totalExperienceYears:
      rd0.totalExperienceYears ?? (profile as any).total_experience_years ?? 0,

    // collections (prefer raw)
    skills: rd0.skills || [],
    experiences: rd0.experiences || [],
    peopleAlsoViewed: rd0.peopleAlsoViewed || [],
    about: rd0.about || (profile as any).about || "",
  };

  return (
    <div className="p-4 bg-slate-50">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Profile Header, About, Skills */}
        <div className="lg:col-span-1 space-y-6">
          <ProfileHeader data={rd} />
          <AboutSection about={rd.about} />
          <SkillsSection skills={rd.skills} />
        </div>

        {/* Column 2: Career Timeline, Network Treemap */}
        <div className="lg:col-span-2 space-y-6">
          <CareerTimeline experiences={rd.experiences} />
          <NetworkTreemap data={rd.peopleAlsoViewed} />
        </div>
      </div>
    </div>
  );
};

export default TalentAnalyticsDashboard;
