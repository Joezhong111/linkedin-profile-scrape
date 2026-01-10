import React from 'react';

interface AboutSectionProps {
  about: string;
}

const AboutSection: React.FC<AboutSectionProps> = ({ about }) => {
  if (!about) return null;

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">About</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">{about}</p>
    </div>
  );
};

export default AboutSection;
