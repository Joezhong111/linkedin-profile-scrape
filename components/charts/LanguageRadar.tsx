import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface Props {
  data: any[];
}

export default function LanguageRadar({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic p-4 text-center">No language data available</div>
    );
  }

  // Ensure we have at least 3 points for a nice radar shape
  const chartData =
    data.length < 3
      ? [...data, ...Array(3 - data.length).fill({ language: '', level: 0, fullMark: 5 })]
      : data;

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm h-full flex flex-col items-center">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2 w-full text-left">
        Language Proficiency
      </h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="currentColor" className="text-gray-200 dark:text-slate-700" />
            <PolarAngleAxis
              dataKey="language"
              tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 600 }}
              className="text-gray-600 dark:text-slate-400"
            />
            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
            <Radar
              name="Proficiency"
              dataKey="level"
              stroke="#8b5cf6"
              fill="#c4b5fd"
              fillOpacity={0.5}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                backgroundColor: 'var(--tooltip-bg, #ffffff)',
              }}
              itemStyle={{ color: 'inherit' }}
              wrapperStyle={{ zIndex: 10000 }}
              allowEscapeViewBox={{ x: true, y: true }}
              formatter={(value, name, props) => [props.payload.proficiency, 'Level']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
        Native (5) • Professional (4) • Working (3) • Limited (2)
      </div>
    </div>
  );
}
