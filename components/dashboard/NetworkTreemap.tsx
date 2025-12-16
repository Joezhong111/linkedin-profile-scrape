import React from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface NetworkTreemapProps {
  data: any[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm text-sm max-w-xs">
        <p className="font-bold text-slate-800">{data.name}</p>
        <p className="text-slate-600 truncate">{data.headline}</p>
        <p className="text-indigo-600 font-medium mb-1">
          {Number(data.value).toLocaleString()} Followers
        </p>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
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
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">
        Network Influence (People Also Viewed)
      </h3>
      <div style={{ width: "100%", height: 400 }}>
        <ResponsiveContainer>
          <Treemap
            data={processedData}
            dataKey="value"
            aspectRatio={4 / 3}
            stroke="#fff"
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
