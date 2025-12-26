import React, { useEffect, useMemo, useState } from "react";
import { LinkedInProfile } from "../types";
import { fetchAllLeads, deleteLead } from "../services/api";
import { MagnifyingGlassIcon, TrashIcon } from "@heroicons/react/24/outline";
import ProfileRow from "../components/ProfileRow";

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

    const [companyFilter, setCompanyFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [hasEmail, setHasEmail] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const rows = await fetchAllLeads();
                setAll(rows);
                setError(null);
            } catch (e: any) {
                setError(e?.message || "Load failed");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const companies = useMemo(() => {
        const set = new Set<string>();
        for (const p of all) {
            if (p.company_name) set.add(p.company_name);
        }
        return Array.from(set).sort();
    }, [all]);

    const locations = useMemo(() => {
        const set = new Set<string>();
        for (const p of all) {
            if (p.location) set.add(p.location);
        }
        return Array.from(set).sort();
    }, [all]);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return all.filter((p: any) => {
            if (companyFilter && p.company_name !== companyFilter) return false;
            if (locationFilter && p.location !== locationFilter) return false;
            if (hasEmail && !p.email) return false;

            if (!term) return true;
            const hay = [
                p.full_name,
                p.headline,
                p.location,
                p.company_name,
                p.job_title,
                p.email,
                p.profile_url
            ].map(v => (v || "").toLowerCase()).join(" ");
            return hay.includes(term);
        });
    }, [all, q, companyFilter, locationFilter, hasEmail]);

    const exportCsv = () => {
        const csv = toCsv(filtered);
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
                <h1 className="text-xl font-bold text-gray-900">Company Leads</h1>
                <div className="flex items-center gap-2">
                    <a href="#/" className="text-sm text-blue-600 hover:underline">
                        ← Back to Home
                    </a>
                    <button
                        onClick={exportCsv}
                        disabled={filtered.length === 0}
                        className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Search leads..."
                            className="bg-transparent w-full focus:outline-none text-sm"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <select
                            value={companyFilter}
                            onChange={e => setCompanyFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Companies</option>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select
                            value={locationFilter}
                            onChange={e => setLocationFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Regions</option>
                            {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                                type="checkbox"
                                checked={hasEmail}
                                onChange={e => setHasEmail(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600"
                            />
                            Has Email
                        </label>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="mt-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            ) : error ? (
                <div className="mt-12 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-center">
                    {error}
                </div>
            ) : filtered.length === 0 ? (
                <div className="mt-12 bg-white border-2 border-dashed border-gray-200 rounded-xl p-20 text-center text-gray-500">
                    No leads found.
                </div>
            ) : (
                <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                            <tr>
                                <th className="p-4 text-left">Lead Info</th>
                                <th className="p-4 text-left">Role & Company</th>
                                <th className="p-4 text-left">Contact</th>
                                <th className="p-4 text-left">Scraped From</th>
                                <th className="p-4 text-center w-20">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {p.photo_url ? (
                                                <img src={p.photo_url} className="h-10 w-10 rounded-full object-cover border border-gray-200" alt="" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                    {p.full_name?.[0] || "?"}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-semibold text-gray-900">{p.full_name}</div>
                                                <div className="text-xs text-gray-500">{p.location}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-gray-900 font-medium">{p.job_title}</div>
                                        <div className="text-xs text-blue-600 hover:underline cursor-pointer">{p.company_name}</div>
                                    </td>
                                    <td className="p-4">
                                        {p.email ? (
                                            <button
                                                onClick={() => handleCopy(p.email)}
                                                className="text-gray-600 hover:text-blue-600 flex items-center gap-1 group"
                                            >
                                                {p.email}
                                                <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-gray-100 px-1 rounded">Copy</span>
                                            </button>
                                        ) : (
                                            <span className="text-gray-400 italic">No email</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs text-gray-500 truncate max-w-[200px]" title={(p as any).source_company_url}>
                                            {(p as any).source_company_url || "Direct Batch"}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleDelete(p.id!)}
                                            className="text-gray-400 hover:text-red-600 p-2"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}
