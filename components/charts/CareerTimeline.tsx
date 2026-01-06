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
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Career Timeline</h3>
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid stroke="currentColor" className="text-gray-100 dark:text-slate-700/50" strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis
                            type="number"
                            domain={[minYear, maxYear]}
                            tickCount={maxYear - minYear}
                            tick={{ fontSize: 10, fill: 'currentColor' }}
                            className="text-gray-400 dark:text-slate-500"
                        />
                        <YAxis
                            type="category"
                            dataKey="company"
                            width={130}
                            tick={{ fontSize: 10, fill: 'currentColor' }}
                            className="text-gray-700 dark:text-slate-300"
                            interval={0}
                        />
                        <Tooltip
                            wrapperStyle={{ zIndex: 10000 }}
                            allowEscapeViewBox={{ x: true, y: true }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-white dark:bg-slate-800 p-3 border border-gray-100 dark:border-slate-700 shadow-lg rounded-lg text-xs">
                                            <p className="font-bold text-gray-800 dark:text-white">{d.role}</p>
                                            <p className="text-blue-600 dark:text-blue-400 font-semibold">{d.company}</p>
                                            <p className="text-gray-500 dark:text-slate-400 mt-1">
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
