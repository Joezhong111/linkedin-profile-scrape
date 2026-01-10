import React from 'react';
import { LinkedInProfile } from '../types';
import { ArrowTopRightOnSquareIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface ProfileCardProps {
  profile: LinkedInProfile;
  handleCopy: (text: string) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile: p, handleCopy }) => {
  const rd: any = p.raw_data || {};

  const photo =
    p.profile_pic_high_quality ||
    p.photo_url ||
    rd.profilePicHighQuality ||
    rd.profilePic ||
    undefined;

  const name =
    p.full_name ||
    rd.fullName ||
    [rd.firstName, rd.lastName].filter(Boolean).join(' ') ||
    'Unknown';
  const title = p.job_title || rd.jobTitle || '-';
  const company = p.company_name || rd.companyName || '-';
  const region =
    p.job_location ||
    p.location ||
    rd.jobLocation ||
    rd.addressWithCountry ||
    rd.addressWithoutCountry ||
    '-';
  const email = p.email || rd.email || '';
  const phone = p.mobile_number || rd.mobileNumber || '';
  const link =
    p.linkedin_public_url || p.profile_url || rd.linkedinPublicUrl || rd.linkedinUrl || '#';

  return (
    <>
      <td className="p-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        <div className="flex items-center gap-3">
          <img
            src={photo}
            alt={name}
            className="h-12 w-12 rounded-full object-cover bg-gray-200 dark:bg-slate-700"
          />
          <div>
            <div className="font-bold">{name}</div>
          </div>
        </div>
      </td>
      <td className="p-3 text-gray-700 dark:text-slate-300">{title}</td>
      <td className="p-3 text-gray-700 dark:text-slate-300">{company}</td>
      <td className="p-3 text-gray-700 dark:text-slate-300">{region}</td>
      <td className="p-3 text-gray-700 dark:text-slate-300 truncate max-w-[16rem]">
        {email || '-'}
        {email && (
          <button
            onClick={() => handleCopy(email)}
            className="ml-2 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
          </button>
        )}
      </td>
      <td className="p-3 text-gray-700 dark:text-slate-300 truncate max-w-[12rem]">
        {phone || '-'}
        {phone && (
          <button
            onClick={() => handleCopy(phone)}
            className="ml-2 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
          </button>
        )}
      </td>
      <td className="p-3">
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          Open <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      </td>
    </>
  );
};

export default ProfileCard;
