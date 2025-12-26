import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
    data: any[];
    byIssuer: any[];
}

const COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];

export default function CertificationTimeline({ data, byIssuer }: Props) {
    if (!data || data.length === 0) {
        return <div className="text-gray-400 text-sm italic p-4 text-center">No certification data available</div>;
    }

    // Sort by year descending for list
    const sortedCerts = [...data].sort((a, b) => (b.year || 0) - (a.year || 0));

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Certifications</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Issuer Distribution Pie */}
                <div className="h-[300px] w-full min-w-0">
                    <h4 className="text-xs text-gray-500 mb-2 uppercase font-medium">By Issuer</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={byIssuer}
                                cx="50%"
                                cy="45%"
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {byIssuer.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip wrapperStyle={{ zIndex: 10000 }} />
                            <Legend
                                layout="horizontal"
                                verticalAlign="bottom"
                                align="center"
                                wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Latest Certs List */}
                <div className="min-w-0">
                    <h4 className="text-xs text-gray-500 mb-3 uppercase font-medium">Recent Awards</h4>
                    <div className="space-y-3 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
                        {sortedCerts.map((cert, idx) => (
                            <div key={idx} className="flex gap-3 items-start p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                                {cert.logo ? (
                                    <img src={cert.logo} alt="" className="w-8 h-8 object-contain rounded-md" />
                                ) : (
                                    <div className="w-8 h-8 bg-green-50 text-green-600 rounded-md flex items-center justify-center text-xs font-bold border border-green-100">
                                        {cert.issuer[0]}
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs font-bold text-gray-800 leading-tight">{cert.name}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                        {cert.issuer} • {cert.year || 'No Date'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
