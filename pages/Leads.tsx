import React, { useEffect, useState, useCallback } from "react";
import { LinkedInProfile } from "../types";
import { fetchAllLeads, deleteLead, batchDeleteLeads, LeadsPaginatedResponse } from "../services/api";
import { MagnifyingGlassIcon, TrashIcon, ChartBarIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import ProfileRow from "../components/ProfileRow";
import LeadDetails from "../components/LeadDetails";

function toCsv(rows: LinkedInProfile[]) {
    const headers = [
        "id",
        "created_at",
        "profile_url",
        "full_name",
        "headline",
        "location",
        "company",
        "title",
        "duration",
        "period",
        "email",
        "source_company_url"
    ];
    const esc = (v: any) => {
        const s = v === undefined || v === null ? "" : String(v);
        return '"' + s.replace(/"/g, '""') + '"';
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
        lines.push(
            [
                esc(r.id),
                esc(r.created_at),
                esc(r.profile_url),
                esc(r.full_name),
                esc(r.headline),
                esc(r.location),
                esc(r.company_name),
                esc(r.job_title),
                esc(r.current_job_duration),
                esc(r.job_period),
                esc(r.email),
                esc((r as any).source_company_url),
            ].join(",")
        );
    }
    return lines.join("\n");
}

export default function Leads() {
    const [all, setAll] = useState<LinkedInProfile[]>([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Filter state (server-side)
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
            // Update filter options from server
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

    // Reload when filters change
    useEffect(() => {
        loadLeads(1, pageSize, {
            q: debouncedQ,
            company: companyFilter,
            location: locationFilter,
            hasEmail: hasEmail || undefined,
        });
    }, [debouncedQ, companyFilter, locationFilter, hasEmail, pageSize, loadLeads]);

    // Reload on page change (but not on filter change)
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
        // Will trigger reload via useEffect
    };

    const resetFilters = () => {
        setQ("");
        setCompanyFilter("");
        setLocationFilter("");
        setHasEmail(false);
    };

    // Batch selection state
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
        if (!window.confirm(`Delete ${selectedIds.size} selected leads?`)) return;

        try {
            await batchDeleteLeads(Array.from(selectedIds));
            setAll(all.filter(p => !selectedIds.has(p.id!)));
            setTotal(t => t - selectedIds.size);
            setSelectedIds(new Set());
        } catch (e: any) {
            alert("Batch delete failed: " + e.message);
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
        if (!window.confirm("Delete this lead?")) return;
        try {
            await deleteLead(id);
            setAll(all.filter(p => p.id !== id));
        } catch (e: any) {
            alert("Delete failed: " + e.message);
        }
    };

    const handleCopy = async (text?: string | null) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch { }
    };

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-20">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Company Leads</h1>
                <div className="flex items-center gap-2">
                    <a href="#/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        ← Back to Home
                    </a>
                    <button
                        onClick={exportCsv}
                        disabled={all.length === 0}
                        className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-slate-400" />
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Search leads..."
                            className="bg-transparent w-full focus:outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <select
                            value={companyFilter}
                            onChange={e => setCompanyFilter(e.target.value)}
                            className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Companies</option>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select
                            value={locationFilter}
                            onChange={e => setLocationFilter(e.target.value)}
                            className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Regions</option>
                            {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={hasEmail}
                                onChange={e => setHasEmail(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600"
                            />
                            Has Email
                        </label>
                        {(q || companyFilter || locationFilter || hasEmail) && (
                            <button
                                onClick={resetFilters}
                                className="text-sm text-gray-500 hover:text-red-600 underline"
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                </div>
                <div className="mt-3 text-sm text-gray-500 dark:text-slate-400">
                    Showing {all.length} of {total} leads
                </div>
            </div>

            {loading ? (
                <div className="mt-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : error ? (
                <div className="mt-12 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 text-center">
                    {error}
                </div>
            ) : all.length === 0 ? (
                <div className="mt-12 bg-white dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-20 text-center text-gray-500 dark:text-slate-400">
                    No leads found.
                </div>
            ) : (
                <>
                    {/* Batch action toolbar */}
                    {selectedIds.size > 0 && (
                        <div className="mt-4 flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                {selectedIds.size} selected
                            </span>
                            <button
                                onClick={handleBatchDelete}
                                className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                                Delete Selected
                            </button>
                            <button
                                onClick={exportSelected}
                                className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            >
                                Export Selected
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white"
                            >
                                Clear Selection
                            </button>
                        </div>
                    )}
                    <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium">
                                <tr>
                                    <th className="p-4 w-12">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === all.length && all.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-gray-300 dark:border-slate-500 text-blue-600 bg-white dark:bg-slate-600"
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </th>
                                    <th className="p-4 text-left">Lead Info</th>
                                    <th className="p-4 text-left">Role & Company</th>
                                    <th className="p-4 text-left">Duration</th>
                                    <th className="p-4 text-left">Period</th>
                                    <th className="p-4 text-left">Contact</th>
                                    <th className="p-4 text-left">Scraped From</th>
                                    <th className="p-4 text-center w-20">Action</th>
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
                                            <div className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{p.company_name}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-gray-700 dark:text-slate-300">{p.current_job_duration || "-"}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-gray-700 dark:text-slate-300 whitespace-nowrap">{p.job_period || "-"}</div>
                                        </td>
                                        <td className="p-4">
                                            {p.email ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(p.email);
                                                    }}
                                                    className="text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 group"
                                                >
                                                    {p.email}
                                                    <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-gray-100 dark:bg-slate-600 px-1 rounded transition-opacity">Copy</span>
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 dark:text-slate-500 italic">No email</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[150px]" title={(p as any).source_company_url}>
                                                {(p as any).source_company_url || "Direct Batch"}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLead(p);
                                                    }}
                                                    className="text-gray-400 hover:text-blue-600 p-2 transition-colors"
                                                    title="View Insights"
                                                >
                                                    <ChartBarIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(p.id!);
                                                    }}
                                                    className="text-gray-400 hover:text-red-600 p-2 transition-colors"
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

                    {/* Pagination Controls */}
                    <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            {/* Page size selector */}
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>Show</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                </select>
                                <span>per page</span>
                                <span className="text-gray-400 mx-2">|</span>
                                <span className="font-medium text-gray-800">
                                    {total.toLocaleString()} total leads
                                </span>
                            </div>

                            {/* Pagination buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    First
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeftIcon className="h-5 w-5" />
                                </button>

                                <div className="flex items-center gap-1">
                                    {/* Page numbers */}
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
                                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${currentPage === pageNum
                                                    ? "bg-blue-600 text-white"
                                                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
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
                                    className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRightIcon className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => handlePageChange(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Last
                                </button>
                            </div>

                            {/* Current page info */}
                            <div className="text-sm text-gray-600">
                                Page <span className="font-medium text-gray-800">{currentPage}</span> of{" "}
                                <span className="font-medium text-gray-800">{totalPages}</span>
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
