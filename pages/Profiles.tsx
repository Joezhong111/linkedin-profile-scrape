import React, { useEffect, useMemo, useState } from "react";
import { LinkedInProfile } from "../types";
import { fetchAllProfiles } from "../services/supabase";
import { MagnifyingGlassIcon, ArrowTopRightOnSquareIcon, SparklesIcon } from "@heroicons/react/24/outline";

function toCsv(rows: LinkedInProfile[]) {
  const headers = [
    "id","created_at","profile_url","full_name","headline","location","about","photo_url","ai_summary"
  ];
  const esc = (v: any) => {
    const s = v === undefined || v === null ? "" : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      esc(r.id), esc(r.created_at), esc(r.profile_url), esc(r.full_name), esc(r.headline), esc(r.location), esc(r.about), esc(r.photo_url), esc(r.ai_summary)
    ].join(","));
  }
  return lines.join("\n");
}

export default function Profiles() {
  const [all, setAll] = useState<LinkedInProfile[]>([]);
  const [q, setQ] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rows = await fetchAllProfiles();
        setAll(rows);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter(p => {
      if (aiOnly && !p.ai_summary) return false;
      if (!term) return true;
      const hay = [p.full_name, p.headline, p.location, p.raw_data?.companyName, p.profile_url].map(v => (v||"").toLowerCase()).join(" ");
      return hay.includes(term);
    });
  }, [all, q, aiOnly]);

  const exportCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profiles_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Captured Profiles</h1>
        <div className="flex items-center gap-2">
          <a href="#/" className="text-sm text-blue-600 hover:underline">← Back to Home</a>
          <button onClick={exportCsv} disabled={filtered.length===0} className="px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Export CSV</button>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search name / headline / location / company" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={aiOnly} onChange={(e)=>setAiOnly(e.target.checked)} />
            <span className="flex items-center gap-1"><SparklesIcon className="h-4 w-4 text-blue-600"/>AI only</span>
          </label>
          <div className="text-sm text-gray-500">{filtered.length} / {all.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="mt-6 text-red-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">No profiles match your filters.</div>
      ) : (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Headline</th>
                <th className="p-3 text-left">Location</th>
                <th className="p-3 text-left">Company</th>
                <th className="p-3 text-left">AI</th>
                <th className="p-3 text-left">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{p.full_name}</td>
                  <td className="p-3 text-gray-700">{p.headline}</td>
                  <td className="p-3 text-gray-700">{p.location}</td>
                  <td className="p-3 text-gray-700">{p.raw_data?.companyName || p.experiences?.[0]?.companyName || ""}</td>
                  <td className="p-3 text-gray-700">{p.ai_summary ? "Yes" : "No"}</td>
                  <td className="p-3"><a href={p.profile_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Open <ArrowTopRightOnSquareIcon className="h-4 w-4"/></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

