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
  const rawData = profile.raw_data as any;

  if (!rawData) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No raw data available to display dashboard.
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Profile Header, About, Skills */}
        <div className="lg:col-span-1 space-y-6">
          <ProfileHeader data={rawData} />
          <AboutSection about={rawData.about} />
          <SkillsSection skills={rawData.skills} />
        </div>

        {/* Column 2: Career Timeline, Network Treemap */}
        <div className="lg:col-span-2 space-y-6">
          <CareerTimeline experiences={rawData.experiences} />
          <NetworkTreemap data={rawData.peopleAlsoViewed} />
        </div>
      </div>
    </div>
  );
};

export default TalentAnalyticsDashboard;
