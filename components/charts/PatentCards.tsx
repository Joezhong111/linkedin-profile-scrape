import React from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';

interface Props {
  data: any[];
}

export default function PatentCards({ data }: Props) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 flex items-center gap-2">
        <LightBulbIcon className="h-5 w-5 text-yellow-500" />
        Patents & Innovation
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map((patent, index) => (
          <div
            key={index}
            className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-100 dark:border-yellow-900/30 flex flex-col justify-between"
          >
            <p
              className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2"
              title={patent.title}
            >
              {patent.title}
            </p>
            {patent.number && (
              <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-900/50 text-yellow-700 dark:text-yellow-500 self-start mt-2 font-mono">
                {patent.number}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
