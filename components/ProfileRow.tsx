import React, { useState } from 'react';
import { LinkedInProfile } from '../types';
import ProfileCard from './ProfileCard';
import TalentAnalyticsDashboard from './dashboard/TalentAnalyticsDashboard';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface ProfileRowProps {
  profile: LinkedInProfile;
  handleCopy: (text: string) => void;
}

const ProfileRow: React.FC<ProfileRowProps> = ({ profile, handleCopy }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
        <td className="p-3 text-center align-middle">
          <button
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              setIsOpen(!isOpen);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200"
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
        <tr className="animate-in fade-in slide-in-from-top-2 duration-200">
          <td colSpan={8} className="p-0 bg-slate-50 dark:bg-slate-900/50">
            <TalentAnalyticsDashboard profile={profile} />
          </td>
        </tr>
      )}
    </>
  );
};

export default ProfileRow;
