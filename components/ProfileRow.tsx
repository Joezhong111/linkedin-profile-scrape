import React, { useState } from "react";
import { LinkedInProfile } from "../types";
import ProfileCard from "./ProfileCard";
import TalentAnalyticsDashboard from "./dashboard/TalentAnalyticsDashboard";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface ProfileRowProps {
  profile: LinkedInProfile;
  handleCopy: (text: string) => void;
}

const ProfileRow: React.FC<ProfileRowProps> = ({ profile, handleCopy }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <tr>
        <td className="p-3 text-center align-middle">
          <button
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              setIsOpen(!isOpen);
            }}
            className="text-gray-400 hover:text-gray-700"
          >
            {isOpen ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
        </td>
        <ProfileCard profile={profile} handleCopy={handleCopy} />
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={8} className="p-0 bg-slate-50">
            <TalentAnalyticsDashboard profile={profile} />
          </td>
        </tr>
      )}
    </>
  );
};

export default ProfileRow;
