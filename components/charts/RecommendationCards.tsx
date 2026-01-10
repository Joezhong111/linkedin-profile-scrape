import React from 'react';
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';

interface Props {
  data: any[];
}

export default function RecommendationCards({ data }: Props) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 flex items-center gap-2">
        <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-purple-500" />
        Recommendations
      </h3>
      <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
        {data.map((rec, index) => (
          <div
            key={index}
            className="bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-50 dark:border-purple-900/30 relative"
          >
            <div className="flex items-start gap-3 mb-2">
              {rec.photo ? (
                <img
                  src={rec.photo}
                  alt={rec.givenBy}
                  className="w-8 h-8 rounded-full object-cover border border-white dark:border-slate-700 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-200 dark:bg-purple-900/50 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">
                  {rec.givenBy[0]}
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-white">{rec.givenBy}</p>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight">
                  {rec.headline || 'LinkedIn User'}
                </p>
                {rec.date && (
                  <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">{rec.date}</p>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-600 dark:text-slate-400 italic leading-relaxed pl-2 border-l-2 border-purple-200 dark:border-purple-800">
              "{rec.excerpt}"
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
