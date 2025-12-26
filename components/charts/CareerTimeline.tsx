import React from 'react';
import {
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface Props {
    data: any[];
}

export default function CareerTimeline({ data }: Props) {
    if (!data || data.length === 0) {
        return <div className="text-gray-400 text-sm italic p-4 text-center">No timeline data available</div>;
    }

    // Calculate min and max years for axis domain
    const years = data.map(d => [d.start, d.end]).flat();
    const minYear = Math.min(...years) - 1;
    const maxYear = Math.max(...years) + 1;

    // Transform data for range bar chart
    // Recharts range bar expects [start, end] as value
    const chartData = data.map(d => ({
        ...d,
        range: [d.start, d.end === new Date().getFullYear() ? d.end + 0.5 : d.end]
    }));

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Career Timeline</h3>
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis
                            type="number"
                            domain={[minYear, maxYear]}
                            tickCount={maxYear - minYear}
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                        />
                        <YAxis
                            type="category"
                            dataKey="company"
                            width={130}
                            tick={{ fontSize: 10, fill: '#374151' }}
                            interval={0}
                        />
                        <Tooltip
                            wrapperStyle={{ zIndex: 10000 }}
                            allowEscapeViewBox={{ x: true, y: true }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-xs">
                                            <p className="font-bold text-gray-800">{d.role}</p>
                                            <p className="text-blue-600 font-semibold">{d.company}</p>
                                            <p className="text-gray-500 mt-1">
                                                {d.start} - {d.isCurrent ? 'Present' : d.end} ({d.duration})
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="range" barSize={12} radius={[4, 4, 4, 4]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.isCurrent ? '#3b82f6' : '#94a3b8'} />
                            ))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
