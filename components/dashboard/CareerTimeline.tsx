import React from 'react';
import { Briefcase } from 'lucide-react';

interface CareerTimelineProps {
  experiences: any[];
}

const CareerTimeline: React.FC<CareerTimelineProps> = ({ experiences }) => {
  if (!experiences || experiences.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Career Timeline</h3>
      <div className="relative pl-4">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
        {experiences.map((exp, index) => (
          <div key={index} className="relative mb-6">
            <div className="absolute -left-1.5 top-1.5 w-4 h-4 bg-indigo-600 rounded-full border-4 border-white dark:border-slate-800"></div>
            <div className="ml-8">
              <p className="text-xs text-slate-500 dark:text-slate-400">{exp.jobStartedOn} - {exp.jobEndedOn || 'Present'}</p>
              <h4 className="font-semibold text-slate-800 dark:text-white mt-1">{exp.title}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">{exp.companyName}</p>
              {exp.jobLocation && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{exp.jobLocation}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CareerTimeline;

