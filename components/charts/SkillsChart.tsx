import React from 'react';
import {
    BarChart,
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

const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export default function SkillsChart({ data }: Props) {
    if (!data || data.length === 0) {
        return <div className="text-gray-400 text-sm italic p-4 text-center">No skills data available</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Top Skills by Endorsements</h3>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={data}
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={140}
                            fontSize={11}
                            tick={{ fill: 'currentColor' }}
                            className="text-gray-600 dark:text-slate-400"
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                backgroundColor: 'var(--tooltip-bg, #ffffff)',
                                color: 'var(--tooltip-text, #374151)'
                            }}
                            itemStyle={{ color: 'inherit' }}
                            cursor={{ fill: 'currentColor', opacity: 0.1 }}
                            wrapperStyle={{ zIndex: 10000 }}
                            allowEscapeViewBox={{ x: true, y: true }}
                        />
                        <Bar dataKey="value" name="Endorsements" radius={[0, 4, 4, 0]} barSize={16}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
