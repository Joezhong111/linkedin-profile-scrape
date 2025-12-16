import React from "react";
import { LinkedInProfile } from "../types";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";

interface ProfileCardProps {
  profile: LinkedInProfile;
  handleCopy: (text: string) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  profile: p,
  handleCopy,
}) => {
  return (
    <>
      <td className="p-3 font-medium text-gray-900 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <img
            src={p.profile_pic_high_quality || p.photo_url || undefined}
            alt={p.full_name}
            className="h-12 w-12 rounded-full object-cover bg-gray-200"
          />
          <div>
            <div className="font-bold">{p.full_name}</div>
          </div>
        </div>
      </td>
      <td className="p-3 text-gray-700">{p.job_title || "-"}</td>
      <td className="p-3 text-gray-700">{p.company_name || "-"}</td>
      <td className="p-3 text-gray-700">
        {p.job_location || p.location || "-"}
      </td>
      <td className="p-3 text-gray-700 truncate max-w-[16rem]">
        {p.email || "-"}
        {p.email && (
          <button
            onClick={() => handleCopy(p.email)}
            className="ml-2 text-gray-400 hover:text-gray-700"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
          </button>
        )}
      </td>
      <td className="p-3 text-gray-700 truncate max-w-[12rem]">
        {p.mobile_number || "-"}
        {p.mobile_number && (
          <button
            onClick={() => handleCopy(p.mobile_number)}
            className="ml-2 text-gray-400 hover:text-gray-700"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
          </button>
        )}
      </td>
      <td className="p-3">
        <a
          href={p.linkedin_public_url || p.profile_url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          Open <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      </td>
    </>
  );
};

export default ProfileCard;
