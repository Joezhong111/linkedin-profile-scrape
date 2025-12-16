import React from "react";
import {
  Mail,
  Briefcase,
  Users,
  UserPlus,
  Phone,
  Building,
  Linkedin,
} from "lucide-react"; // Using lucide-react as requested

interface ProfileHeaderProps {
  data: any;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
}> = ({ icon, label, value }) => (
  <div className="bg-slate-100 p-4 rounded-lg flex items-start">
    <div className="bg-white p-2 rounded-full mr-3 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="text-lg font-bold text-slate-800 break-words">
        {value}
      </div>
    </div>
  </div>
);

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div
        className="h-24 bg-cover bg-center"
        style={{
          backgroundImage: data.backgroundPic
            ? `url(${data.backgroundPic})`
            : undefined,
        }}
      ></div>
      <div className="p-6">
        <div className="flex items-center -mt-16">
          <img
            src={data.profilePicHighQuality || data.profilePic || undefined}
            alt={data.fullName}
            className="h-24 w-24 rounded-full border-4 border-white bg-gray-200"
          />
          <div className="ml-4 mt-12">
            <h1 className="text-xl font-bold text-slate-900">
              {data.fullName}
            </h1>
            <p className="text-sm text-slate-600">{data.headline}</p>
            <p className="text-xs text-slate-500 mt-1">
              {data.addressWithCountry}
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <StatCard
            icon={<Briefcase size={20} className="text-indigo-600" />}
            label="Total Experience"
            value={`${data.totalExperienceYears || 0} Years`}
          />
          <StatCard
            icon={<Users size={20} className="text-indigo-600" />}
            label="Followers"
            value={data.followers || 0}
          />
          <StatCard
            icon={<UserPlus size={20} className="text-indigo-600" />}
            label="Connections"
            value={data.connections || 0}
          />
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-2 gap-3">
          {data.email && (
            <a href={`mailto:${data.email}`} className="col-span-1">
              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <Mail size={16} />
                Email
              </button>
            </a>
          )}
          {data.mobileNumber && (
            <a href={`tel:${data.mobileNumber}`} className="col-span-1">
              <button className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <Phone size={16} />
                Call
              </button>
            </a>
          )}
          {data.companyWebsite && (
            <a
              href={data.companyWebsite}
              target="_blank"
              rel="noreferrer"
              className="col-span-1"
            >
              <button className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <Building size={16} />
                Company Website
              </button>
            </a>
          )}
          {data.companyLinkedin && (
            <a
              href={data.companyLinkedin}
              target="_blank"
              rel="noreferrer"
              className="col-span-1"
            >
              <button className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <Linkedin size={16} />
                Company LinkedIn
              </button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
