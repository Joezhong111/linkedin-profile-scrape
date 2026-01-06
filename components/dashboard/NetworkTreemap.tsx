import React from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface NetworkTreemapProps {
  data: any[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-3 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm text-sm max-w-xs">
        <p className="font-bold text-slate-800 dark:text-white">{data.name}</p>
        <p className="text-slate-600 dark:text-slate-300 truncate">{data.headline}</p>
        <p className="text-indigo-600 dark:text-indigo-400 font-medium mb-1">
          {Number(data.value).toLocaleString()} Followers
        </p>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open LinkedIn
          </a>
        )}
      </div>
    );
  }
  return null;
};

const NetworkTreemap: React.FC<NetworkTreemapProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const processedData = data
    .filter((p) => (p.follower_count || 0) > 0)
    .map((p) => ({
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      headline: p.headline,
      value: p.follower_count,
      url:
        p.url ||
        (p.public_identifier
          ? `https://www.linkedin.com/in/${p.public_identifier}`
          : undefined),
    }));

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
        Network Influence (People Also Viewed)
      </h3>
      <div style={{ width: "100%", height: 400 }}>
        <ResponsiveContainer>
          <Treemap
            data={processedData}
            dataKey="value"
            aspectRatio={4 / 3}
            stroke="currentColor"
            className="text-white dark:text-slate-800"
            fill="#8884d8"
            onClick={(data) => {
              if (data && data.url) {
                window.open(data.url, "_blank");
              }
            }}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default NetworkTreemap;
