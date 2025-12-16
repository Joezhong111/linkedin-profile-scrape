import React from "react";

interface SkillsSectionProps {
  skills: string[];
}

const SkillsSection: React.FC<SkillsSectionProps> = ({ skills }) => {
  if (!skills || skills.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Skills</h3>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill, index) => (
          <span
            key={index}
            className="px-3 py-1 text-sm font-medium text-indigo-800 bg-indigo-100 rounded-full"
          >
            {skill.title}
          </span>
        ))}
      </div>
    </div>
  );
};

export default SkillsSection;
