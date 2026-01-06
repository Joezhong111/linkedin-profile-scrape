import React, { useEffect, useState, useCallback, useRef } from "react";
import { LinkedInProfile } from "../types";
import { fetchAllLeads, deleteLead, batchDeleteLeads, LeadsPaginatedResponse } from "../services/api";
import {
    MagnifyingGlassIcon,
    TrashIcon,
    ChartBarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EnvelopeIcon,
    MapPinIcon,
    BriefcaseIcon,
    FunnelIcon,
    XMarkIcon,
    EllipsisVerticalIcon
} from "@heroicons/react/24/outline";
import LeadDetails from "../components/LeadDetails";

function toCsv(rows: LinkedInProfile[]) {
    const headers = [
        "id", "created_at", "profile_url", "full_name", "headline",
        "location", "company", "title", "duration", "period", "email", "source_company_url"
    ];
    const esc = (v: any) => {
        const s = v === undefined || v === null ? "" : String(v);
        return '"' + s.replace(/"/g, '""') + '"';
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
        lines.push([
            esc(r.id), esc(r.created_at), esc(r.profile_url), esc(r.full_name),
            esc(r.headline), esc(r.location), esc(r.company_name), esc(r.job_title),
            esc(r.current_job_duration), esc(r.job_period), esc(r.email),
            esc((r as any).source_company_url),
        ].join(","));
    }
    return lines.join("\n");
}

// Mobile Lead Card Component with swipe-to-delete
function LeadCard({
    lead,
    isSelected,
    onSelect,
    onView,
    onDelete,
    onCopyEmail
}: {
    lead: LinkedInProfile;
    isSelected: boolean;
    onSelect: () => void;
    onView: () => void;
    onDelete: () => void;
    onCopyEmail: () => void;
}) {
    const [swipeX, setSwipeX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const startX = useRef(0);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const diff = startX.current - e.touches[0].clientX;
        // Only allow left swipe, max 100px
        setSwipeX(Math.min(Math.max(diff, 0), 100));
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);
        if (swipeX > 60) {
            // Trigger delete confirmation
            onDelete();
        }
        setSwipeX(0);
    };

    return (
        <div className="relative overflow-hidden rounded-xl">
            {/* Delete action background */}
            <div
                className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center"
                style={{ opacity: swipeX / 100 }}
            >
                <TrashIcon className="h-6 w-6 text-white" />
            </div>

            {/* Card content */}
            <div
                ref={cardRef}
                className={`relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-4 transition-transform ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                style={{ transform: `translateX(-${swipeX}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={onView}
            >
                <div className="flex items-start gap-3">
                    {/* Checkbox - larger touch target */}
                    <div
                        className="flex-shrink-0 p-2 -m-2"
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    >
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onSelect}
                            className="h-5 w-5 rounded border-gray-300 dark:border-slate-500 text-blue-600 bg-white dark:bg-slate-600"
                        />
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        {lead.photo_url ? (
                            <img src={lead.photo_url} className="h-12 w-12 rounded-full object-cover border-2 border-gray-100 dark:border-slate-700" alt="" />
                        ) : (
                            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                                {lead.full_name?.[0] || "?"}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{lead.full_name}</h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400 truncate">{lead.job_title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-500">
                            <span className="flex items-center gap-1 truncate">
                                <BriefcaseIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{lead.company_name}</span>
                            </span>
                            {lead.location && (
                                <span className="flex items-center gap-1 truncate">
                                    <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{lead.location.split(',')[0]}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                        {lead.email && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCopyEmail(); }}
                                className="p-3 -m-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg active:scale-95 transition-transform"
                                title="复制邮箱"
                            >
                                <EnvelopeIcon className="h-5 w-5" />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onView(); }}
                            className="p-3 -m-1 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg active:scale-95 transition-transform"
                            title="查看详情"
                        >
                            <ChartBarIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Email badge */}
                {lead.email && (
                    <div className="mt-2 flex items-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                            <EnvelopeIcon className="h-3 w-3" />
                            {lead.email}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Leads() {
    const [all, setAll] = useState<LinkedInProfile[]>([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Filter state
    const [companyFilter, setCompanyFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [hasEmail, setHasEmail] = useState(false);
    const [selectedLead, setSelectedLead] = useState<LinkedInProfile | null>(null);

    // Filter options from server
    const [companies, setCompanies] = useState<string[]>([]);
    const [locations, setLocations] = useState<string[]>([]);

    // Debounce search
    const [debouncedQ, setDebouncedQ] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(q), 300);
        return () => clearTimeout(timer);
    }, [q]);

    const loadLeads = useCallback(async (page: number, size: number, filters: {
        q?: string;
        company?: string;
        location?: string;
        hasEmail?: boolean;
    }) => {
        try {
            setLoading(true);
            const response = await fetchAllLeads(page, size, filters);
            setAll(response.data);
            setTotal(response.total);
            setTotalPages(response.totalPages);
            setCurrentPage(response.page);
            if (response.filters) {
                setCompanies(response.filters.companies);
                setLocations(response.filters.locations);
            }
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Load failed");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLeads(1, pageSize, {
            q: debouncedQ,
            company: companyFilter,
            location: locationFilter,
            hasEmail: hasEmail || undefined,
        });
    }, [debouncedQ, companyFilter, locationFilter, hasEmail, pageSize, loadLeads]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            loadLeads(newPage, pageSize, {
                q: debouncedQ,
                company: companyFilter,
                location: locationFilter,
                hasEmail: hasEmail || undefined,
            });
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
    };

    const resetFilters = () => {
        setQ("");
        setCompanyFilter("");
        setLocationFilter("");
        setHasEmail(false);
        setShowFilters(false);
    };

    const activeFilterCount = [companyFilter, locationFilter, hasEmail].filter(Boolean).length;

    // Batch selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelectAll = () => {
        if (selectedIds.size === all.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(all.map(p => p.id!)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`删除 ${selectedIds.size} 条选中的记录?`)) return;

        try {
            await batchDeleteLeads(Array.from(selectedIds));
            setAll(all.filter(p => !selectedIds.has(p.id!)));
            setTotal(t => t - selectedIds.size);
            setSelectedIds(new Set());
        } catch (e: any) {
            alert("批量删除失败: " + e.message);
        }
    };

    const exportSelected = () => {
        const selectedLeads = all.filter(p => selectedIds.has(p.id!));
        const csv = toCsv(selectedLeads.length > 0 ? selectedLeads : all);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportCsv = () => {
        const csv = toCsv(all);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("确定删除这条记录?")) return;
        try {
            await deleteLead(id);
            setAll(all.filter(p => p.id !== id));
            setTotal(t => t - 1);
        } catch (e: any) {
            alert("删除失败: " + e.message);
        }
    };

    const handleCopy = async (text?: string | null) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch { }
    };

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6 pb-24 sm:pb-20">
            {/* Header - Mobile optimized */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Company Leads</h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                        {total.toLocaleString()} 条记录
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a href="#/" className="hidden sm:inline text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        ← Back
                    </a>
                    <button
                        onClick={exportCsv}
                        disabled={all.length === 0}
                        className="px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 shadow-sm transition-transform"
                    >
                        <span className="hidden sm:inline">Export CSV</span>
                        <span className="sm:hidden">导出</span>
                    </button>
                </div>
            </div>

            {/* Search & Filters - Mobile optimized */}
            <div className="mt-4 space-y-3">
                {/* Search bar */}
                <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-slate-400 flex-shrink-0" />
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="搜索姓名、公司、职位..."
                            className="bg-transparent w-full focus:outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400"
                        />
                        {q && (
                            <button onClick={() => setQ("")} className="p-1">
                                <XMarkIcon className="h-4 w-4 text-gray-400" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2.5 rounded-xl border shadow-sm transition-colors relative ${showFilters || activeFilterCount > 0
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
                            }`}
                    >
                        <FunnelIcon className="h-5 w-5" />
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Filter panel - Collapsible */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 shadow-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-3">
                            <select
                                value={companyFilter}
                                onChange={e => setCompanyFilter(e.target.value)}
                                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">全部公司</option>
                                {companies.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                value={locationFilter}
                                onChange={e => setLocationFilter(e.target.value)}
                                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">全部地区</option>
                                {locations.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={hasEmail}
                                    onChange={e => setHasEmail(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                />
                                仅显示有邮箱
                            </label>
                            {activeFilterCount > 0 && (
                                <button onClick={resetFilters} className="text-sm text-red-600 dark:text-red-400 font-medium">
                                    清除筛选
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Batch action bar - Fixed at bottom on mobile when items selected */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-3 shadow-lg sm:relative sm:mt-4 sm:rounded-lg sm:border sm:shadow-sm">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={selectedIds.size === all.length}
                            onChange={toggleSelectAll}
                            className="h-5 w-5 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                            已选 {selectedIds.size} 项
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportSelected}
                            className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg active:scale-95 transition-transform"
                        >
                            导出
                        </button>
                        <button
                            onClick={handleBatchDelete}
                            className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg active:scale-95 transition-transform"
                        >
                            删除
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-2 text-gray-500 dark:text-slate-400"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="mt-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : error ? (
                <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 text-center">
                    {error}
                </div>
            ) : all.length === 0 ? (
                <div className="mt-8 bg-white dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-12 sm:p-20 text-center text-gray-500 dark:text-slate-400">
                    暂无数据
                </div>
            ) : (
                <>
                    {/* Mobile: Card View */}
                    <div className="mt-4 space-y-3 md:hidden">
                        {all.map((p) => (
                            <LeadCard
                                key={p.id}
                                lead={p}
                                isSelected={selectedIds.has(p.id!)}
                                onSelect={() => toggleSelect(p.id!)}
                                onView={() => setSelectedLead(p)}
                                onDelete={() => handleDelete(p.id!)}
                                onCopyEmail={() => handleCopy(p.email)}
                            />
                        ))}
                    </div>

                    {/* Desktop: Table View */}
                    <div className="hidden md:block mt-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium">
                                <tr>
                                    <th className="p-4 w-12">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === all.length && all.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-gray-300 dark:border-slate-500 text-blue-600 bg-white dark:bg-slate-600"
                                        />
                                    </th>
                                    <th className="p-4 text-left min-w-[200px]">Lead Info</th>
                                    <th className="p-4 text-left min-w-[150px]">Role & Company</th>
                                    <th className="p-4 text-left hidden lg:table-cell">Duration</th>
                                    <th className="p-4 text-left hidden xl:table-cell">Period</th>
                                    <th className="p-4 text-left">Contact</th>
                                    <th className="p-4 text-left hidden 2xl:table-cell">Source</th>
                                    <th className="p-4 text-center w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {all.map((p) => (
                                    <tr
                                        key={p.id}
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${selectedIds.has(p.id!) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                                        onClick={() => setSelectedLead(p)}
                                    >
                                        <td className="p-4" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(p.id!)}
                                                onChange={() => toggleSelect(p.id!)}
                                                className="rounded border-gray-300 dark:border-slate-500 text-blue-600 bg-white dark:bg-slate-600"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {p.photo_url ? (
                                                    <img src={p.photo_url} className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-slate-600" alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                                                        {p.full_name?.[0] || "?"}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-semibold text-gray-900 dark:text-white">{p.full_name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-slate-400">{p.location}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-gray-900 dark:text-white font-medium">{p.job_title}</div>
                                            <div className="text-xs text-blue-600 dark:text-blue-400">{p.company_name}</div>
                                        </td>
                                        <td className="p-4 hidden lg:table-cell">
                                            <div className="text-gray-700 dark:text-slate-300">{p.current_job_duration || "-"}</div>
                                        </td>
                                        <td className="p-4 hidden xl:table-cell">
                                            <div className="text-gray-700 dark:text-slate-300 whitespace-nowrap">{p.job_period || "-"}</div>
                                        </td>
                                        <td className="p-4">
                                            {p.email ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleCopy(p.email); }}
                                                    className="text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 group"
                                                >
                                                    <span className="truncate max-w-[150px]">{p.email}</span>
                                                    <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-gray-100 dark:bg-slate-600 px-1 rounded">Copy</span>
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 dark:text-slate-500 italic">No email</span>
                                            )}
                                        </td>
                                        <td className="p-4 hidden 2xl:table-cell">
                                            <div className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[150px]">
                                                {(p as any).source_company_url || "Direct"}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedLead(p); }}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <ChartBarIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id!); }}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination - Mobile optimized */}
                    <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            {/* Page size - hide on mobile */}
                            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                                <span>Show</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                    className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-2 py-1 text-sm"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span>per page</span>
                            </div>

                            {/* Pagination buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
                                >
                                    <ChevronLeftIcon className="h-5 w-5" />
                                </button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`min-w-[40px] h-10 text-sm font-medium rounded-lg transition-colors active:scale-95 ${currentPage === pageNum
                                                        ? "bg-blue-600 text-white"
                                                        : "border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600"
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
                                >
                                    <ChevronRightIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Current page info */}
                            <div className="text-sm text-gray-600 dark:text-slate-400">
                                <span className="font-medium text-gray-800 dark:text-slate-200">{currentPage}</span>
                                <span> / </span>
                                <span className="font-medium text-gray-800 dark:text-slate-200">{totalPages}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {selectedLead && (
                <LeadDetails
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                />
            )}
        </main>
    );
}
