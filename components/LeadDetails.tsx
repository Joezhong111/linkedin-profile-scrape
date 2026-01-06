import React, { useState } from "react";
import { LinkedInProfile } from "../types";
import {
    transformSkillsData,
    transformExperienceTimeline,
    transformLanguagesData,
    transformCertificationsData,
    transformCertsByIssuer,
    transformPatentsData,
    transformRecommendationsData,
    getProfileStats,
    transformFeaturedData
} from "../lib/data-transformer";
import {
    XMarkIcon,
    ChartBarIcon,
    BriefcaseIcon,
    AcademicCapIcon,
    LanguageIcon,
    LightBulbIcon,
    ChatBubbleBottomCenterTextIcon,
    CodeBracketIcon,
    DocumentTextIcon
} from "@heroicons/react/24/outline";

// Chart Components
import SkillsChart from "./charts/SkillsChart";
import CareerTimeline from "./charts/CareerTimeline";
import LanguageRadar from "./charts/LanguageRadar";
import CertificationTimeline from "./charts/CertificationTimeline";
import PatentCards from "./charts/PatentCards";
import RecommendationCards from "./charts/RecommendationCards";

interface Props {
    lead: LinkedInProfile;
    onClose: () => void;
}

const TABS = [
    { id: 'overview', label: 'Overview', icon: DocumentTextIcon },
    { id: 'experience', label: 'Experience', icon: BriefcaseIcon },
    { id: 'skills', label: 'Skills', icon: CodeBracketIcon },
    { id: 'education', label: 'Education & Certs', icon: AcademicCapIcon },
    { id: 'more', label: 'More', icon: LightBulbIcon },
    { id: 'raw', label: 'Raw Data', icon: ChartBarIcon },
];

export default function LeadDetails({ lead, onClose }: Props) {
    const [activeTab, setActiveTab] = useState('overview');
    const rawData = lead.raw_data || {};
    const stats = getProfileStats(rawData);

    // Prepare Data
    const skillsData = transformSkillsData(rawData);
    const timelineData = transformExperienceTimeline(rawData);
    const languagesData = transformLanguagesData(rawData);
    const certsData = transformCertificationsData(rawData);
    const certsByIssuer = transformCertsByIssuer(rawData);
    const patentsData = transformPatentsData(rawData);
    const recommendationsData = transformRecommendationsData(rawData);
    const featuredData = transformFeaturedData(rawData);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-2 md:p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl shadow-2xl w-[95%] md:w-full max-w-6xl max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-200 dark:border-slate-700">

                {/* Header */}
                <div className="px-4 py-3 md:px-6 md:py-5 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        {lead.photo_url ? (
                            <img src={lead.photo_url} alt={lead.full_name} className="w-14 h-14 rounded-full border-2 border-gray-100 dark:border-slate-700 shadow-sm object-cover" />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl">
                                {lead.full_name?.charAt(0)}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{lead.full_name}</h2>
                            <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{lead.job_title} at {lead.company_name}</p>
                            <div className="hidden sm:flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500"><BriefcaseIcon className="w-3 h-3" /> {stats.experienceCount} Roles</span>
                                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500"><CodeBracketIcon className="w-3 h-3" /> {stats.skillsCount} Skills</span>
                                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500"><LanguageIcon className="w-3 h-3" /> {stats.languagesCount} Langs</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 shrink-0"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-4 md:px-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex gap-1 overflow-x-auto no-scrollbar shrink-0 z-10">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }
                            `}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50/30 dark:bg-slate-900/40 p-4 md:p-6 pb-20 relative">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Left Col: Timeline */}
                                <div className="md:col-span-2 space-y-6 min-w-0">
                                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">About</h3>
                                        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                            {lead.about || rawData.about || "No summary available."}
                                        </p>
                                    </div>
                                    <div className="relative z-0">
                                        <CareerTimeline data={timelineData} />
                                    </div>
                                    {featuredData.length > 0 && (
                                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Featured</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                {featuredData.map((item: any, i: number) => (
                                                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="group block">
                                                        <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-600 relative">
                                                            {item.image ? (
                                                                <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-500">
                                                                    <DocumentTextIcon className="w-8 h-8" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="mt-2 text-xs font-semibold text-gray-800 dark:text-slate-200 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">{item.title}</p>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Col: Skills & Stats */}
                                <div className="space-y-6 min-w-0">
                                    <div className="relative z-0">
                                        <SkillsChart data={skillsData} />
                                    </div>
                                    <div className="relative z-0">
                                        <LanguageRadar data={languagesData} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EXPERIENCE TAB */}
                    {activeTab === 'experience' && (
                        <div className="space-y-6">
                            <div className="relative z-0">
                                <CareerTimeline data={timelineData} />
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Detailed Experience</h3>
                                <div className="space-y-6 border-l-2 border-blue-100 dark:border-blue-900/50 pl-4 ml-2">
                                    {(rawData.experience || []).map((exp: any, i: number) => (
                                        <div key={i} className="relative">
                                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-800"></div>
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{exp.title || exp.position}</h4>
                                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{exp.companyName}</p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                                {exp.startDate?.year || '?'} - {exp.endDate?.year || 'Present'} • {exp.duration} • {exp.location}
                                            </p>
                                            {exp.description && (
                                                <p className="text-xs text-gray-600 dark:text-slate-400 mt-2 leading-relaxed opacity-90">
                                                    {exp.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SKILLS TAB */}
                    {activeTab === 'skills' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                            <div className="md:col-span-2">
                                <SkillsChart data={skillsData} />
                            </div>
                            <LanguageRadar data={languagesData} />
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-y-auto max-h-[400px]">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">All Skills ({stats.skillsCount})</h3>
                                <div className="flex flex-wrap gap-2">
                                    {(rawData.skills || []).map((skill: any, i: number) => (
                                        <span key={i} className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 text-xs rounded-full border border-gray-200 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-100 dark:hover:border-blue-800 transition-colors cursor-default">
                                            {skill.name}
                                            {skill.endorsements && <span className="ml-1 opacity-50 text-[10px]">({skill.endorsements})</span>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EDUCATION & CERTS TAB */}
                    {activeTab === 'education' && (
                        <div className="grid grid-cols-1 gap-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <CertificationTimeline data={certsData} byIssuer={certsByIssuer} />

                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                            <AcademicCapIcon className="w-5 h-5 text-blue-500" />
                                            Education ({((rawData.education || []).length)})
                                        </h3>
                                        <div className="space-y-4">
                                            {(rawData.education || []).map((edu: any, i: number) => (
                                                <div key={i} className="flex gap-4 items-start p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                                                    {edu.schoolLogo?.url ? (
                                                        <img src={edu.schoolLogo.url} alt="" className="w-10 h-10 object-contain rounded-md bg-white p-1" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                                                            {edu.schoolName?.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{edu.schoolName}</h4>
                                                        <p className="text-xs text-gray-600 dark:text-slate-300">{edu.degree} {edu.fieldOfStudy && `in ${edu.fieldOfStudy}`}</p>
                                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                                            {edu.startDate?.year} - {edu.endDate?.year}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MORE TAB */}
                    {activeTab === 'more' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PatentCards data={patentsData} />
                            <RecommendationCards data={recommendationsData} />

                            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm md:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Volunteering ({((rawData.volunteering || []).length)})</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(rawData.volunteering || []).map((vol: any, i: number) => (
                                        <div key={i} className="p-3 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-50 dark:border-green-900/30">
                                            <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">{vol.role}</h4>
                                            <p className="text-xs text-green-700 dark:text-green-400">{vol.organizationName}</p>
                                            {vol.cause && <span className="text-[10px] text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-slate-700 mt-2 inline-block">{vol.cause}</span>}
                                        </div>
                                    ))}
                                    {(rawData.volunteering || []).length === 0 && (
                                        <p className="text-sm text-gray-400 dark:text-slate-500 italic">No volunteering experience found.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RAW DATA TAB */}
                    {activeTab === 'raw' && (
                        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-inner h-full flex flex-col">
                            <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                                <span className="text-xs text-gray-400 font-mono">raw_data.json</span>
                                <button
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(rawData, null, 2))}
                                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Copy JSON
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                                <pre className="text-xs font-mono text-green-400 leading-relaxed">
                                    {JSON.stringify(rawData, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
