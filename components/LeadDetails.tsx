import React, { useState } from "react";
import { LinkedInProfile } from "../types";
import {
    transformSkillsData,
    transformExperienceData,
} from "../lib/data-transformer";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import { ChevronDownIcon, ChevronUpIcon, ChartBarIcon, BriefcaseIcon, AcademicCapIcon, CodeBracketIcon } from "@heroicons/react/24/outline";

interface Props {
    lead: LinkedInProfile;
    onClose: () => void;
}

const COLORS = ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#eff6ff"];

export default function LeadDetails({ lead, onClose }: Props) {
    const [showRaw, setShowRaw] = useState(false);
    const rawData = lead.raw_data || {};

    const skillsData = transformSkillsData(rawData);
    const expData = transformExperienceData(rawData);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-center gap-4">
                        {lead.photo_url ? (
                            <img src={lead.photo_url} alt={lead.full_name} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                {lead.full_name?.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{lead.full_name}</h2>
                            <p className="text-sm text-gray-500">{lead.job_title} at {lead.company_name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Skills Chart */}
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                <CodeBracketIcon className="h-5 w-5 text-blue-500" />
                                Top Skills (by Endorsements)
                            </h3>
                            <div className="h-64 w-full">
                                {skillsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={skillsData} margin={{ left: 20, right: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                cursor={{ fill: '#f3f4f6' }}
                                            />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                        No skill data available
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Experience Distribution */}
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                <BriefcaseIcon className="h-5 w-5 text-blue-500" />
                                Experience Share (Months)
                            </h3>
                            <div className="h-64 w-full">
                                {expData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={expData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {expData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                        No experience data available
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Education & About */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <AcademicCapIcon className="h-5 w-5 text-blue-500" />
                                Professional Summary
                            </h3>
                            <div className="bg-blue-50/30 rounded-xl p-4 text-sm text-gray-600 leading-relaxed border border-blue-100/50">
                                {lead.about || (rawData.about) || "No summary provided."}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <academic-cap-icon className="h-5 w-5 text-blue-500" />
                                Latest Education
                            </h3>
                            <div className="space-y-3">
                                {(rawData.education || rawData.educations || []).slice(0, 2).map((edu: any, i: number) => (
                                    <div key={i} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                        <p className="text-xs font-bold text-gray-900">{edu.schoolName}</p>
                                        <p className="text-[10px] text-gray-500">{edu.degree}</p>
                                        {edu.insights && <p className="text-[10px] text-blue-600 mt-1">{edu.insights}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Raw Data Dropdown */}
                    <div className="border-t border-gray-100 pt-6">
                        <button
                            onClick={() => setShowRaw(!showRaw)}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                        >
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <ChartBarIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                                Inspect Raw Data (JSON)
                            </span>
                            {showRaw ? <ChevronUpIcon className="h-5 w-5 text-gray-400" /> : <ChevronDownIcon className="h-5 w-5 text-gray-400" />}
                        </button>
                        {showRaw && (
                            <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                                <pre className="p-4 bg-gray-900 text-green-400 text-xs rounded-xl overflow-x-auto max-h-96 custom-scrollbar">
                                    {JSON.stringify(rawData, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md active:scale-95"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
