import React, { useEffect, useMemo, useState } from "react";
import { LinkedInProfile } from "../types";

import { fetchAllProfiles } from "../services/api";
import { MagnifyingGlassIcon, SparklesIcon } from "@heroicons/react/24/outline";
import ProfileRow from "../components/ProfileRow";

function toCsv(rows: LinkedInProfile[]) {
  const headers = [
    "id",
    "created_at",
    "profile_url",
    "full_name",
    "headline",
    "location",
    "about",
    "photo_url",
    "ai_summary",
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
        esc(r.about),
        esc(r.photo_url),
        esc(r.ai_summary),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export default function Profiles() {
  const [all, setAll] = useState<LinkedInProfile[]>([]);
  const [q, setQ] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [minFollowers, setMinFollowers] = useState<number>(0);
  const [industryQ, setIndustryQ] = useState("");

  const [companyQ, setCompanyQ] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasExp, setHasExp] = useState(false);
  const [hasEdu, setHasEdu] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [sortBy, setSortBy] = useState<"newest" | "followers" | "default">(
    "default"
  );

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const p of all) {
      if (p.location) set.add(p.location);
    }
    return Array.from(set).sort();
  }, [all]);

  const clearFilters = () => {
    setQ("");
    setAiOnly(false);
    setHasEmail(false);
    setHasPhone(false);
    setMinFollowers(0);
    setIndustryQ("");
    setCompanyQ("");
    setLocationFilter("");
    setHasPhoto(false);
    setHasExp(false);
    setHasEdu(false);
    setDateFrom("");
    setDateTo("");
  };

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
    return all.filter((p: LinkedInProfile) => {
      const followers =
        (p.followers as any) ?? (p as any).raw_data?.followers ?? 0;
      const emailVal = (p.email as any) ?? (p as any).raw_data?.email;
      const phoneVal =
        (p.mobile_number as any) ?? (p as any).raw_data?.mobileNumber;
      const industryVal =
        (p.company_industry as any) ??
        (p as any).raw_data?.companyIndustry ??
        "";
      const companyVal =
        (p.company_name as any) ?? (p as any).raw_data?.companyName ?? "";
      const loc =
        p.location ||
        (p as any).address_with_country ||
        (p as any).raw_data?.addressWithCountry ||
        "";

      if (aiOnly && !p.ai_summary) return false;
      if (hasEmail && !emailVal) return false;
      if (hasPhone && !phoneVal) return false;
      if (minFollowers && followers < minFollowers) return false;
      if (
        industryQ &&
        !String(industryVal).toLowerCase().includes(industryQ.toLowerCase())
      )
        return false;
      if (
        companyQ &&
        !String(companyVal).toLowerCase().includes(companyQ.toLowerCase())
      )
        return false;

      if (locationFilter && loc !== locationFilter) return false;
      if (hasPhoto && !p.photo_url) return false;
      const expList =
        (p.experiences as any[]) || (p as any).raw_data?.experiences || [];
      if (hasExp && expList.length === 0) return false;
      const eduList =
        (p.education as any[]) || (p as any).raw_data?.educations || [];
      if (hasEdu && eduList.length === 0) return false;

      if (dateFrom || dateTo) {
        const created = p.created_at ? new Date(p.created_at).getTime() : NaN;
        if (!isNaN(created)) {
          if (dateFrom && created < new Date(dateFrom).getTime()) return false;
          if (
            dateTo &&
            created > new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
          )
            return false;
        }
      }

      if (!term) return true;
      const hay = [
        p.full_name,
        p.first_name,
        p.last_name,
        p.headline,
        loc,
        (p as any).raw_data?.companyName,
        p.profile_url,
        p.about,
        p.ai_summary,
        String(industryVal),
      ]
        .map((v) => (v || "").toLowerCase())
        .join(" ");
      return hay.includes(term);
    });
  }, [
    all,
    q,
    aiOnly,
    hasEmail,
    hasPhone,
    minFollowers,
    industryQ,
    companyQ,
    locationFilter,
    hasPhoto,
    hasExp,
    hasEdu,
    dateFrom,
    dateTo,
  ]);

  const exportCsv = () => {
    const csv = toCsv(sorted);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profiles_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (text?: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch { }
  };

  const sorted = useMemo(() => {
    const base = filtered.slice() as LinkedInProfile[];
    if (sortBy === "followers") {
      base.sort(
        (a: LinkedInProfile, b: LinkedInProfile) =>
          (b.followers || 0) - (a.followers || 0)
      );
    } else if (sortBy === "newest") {
      base.sort(
        (a: LinkedInProfile, b: LinkedInProfile) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    }
    return base;
  }, [filtered, sortBy]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Captured Profiles</h1>
        <div className="flex items-center gap-2">
          <a href="#/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to Home
          </a>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            <input
              value={q}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setQ(e.target.value)
              }
              placeholder="Search name / headline / location / company / about"
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={aiOnly}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAiOnly(e.target.checked)
              }
              className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600"
            />
            <span className="flex items-center gap-1">
              <SparklesIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              AI only
            </span>
          </label>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <label className="mr-2 text-gray-600 dark:text-slate-400">Sort</label>
              <select
                value={sortBy}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSortBy(
                    e.target.value as "default" | "followers" | "newest"
                  )
                }
                className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-2 py-1 text-sm"
              >
                <option value="default">Default</option>
                <option value="followers">Followers desc</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {filtered.length} / {all.length}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setLocationFilter(e.target.value)
              }
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {locations.map((loc: string) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Contact</label>
            <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-slate-300">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setHasEmail(e.target.checked)
                  }
                  className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600"
                />
                <span>Has Email</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setHasPhone(e.target.checked)
                  }
                  className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600"
                />
                <span>Has Phone</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Min Followers
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={minFollowers}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setMinFollowers(Number(e.target.value) || 0)
              }
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
              placeholder="e.g. 100000"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Industry contains
            </label>
            <input
              type="text"
              value={industryQ}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setIndustryQ(e.target.value)
              }
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
              placeholder="Software / Non-profit / Energy"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Company contains
            </label>
            <input
              type="text"
              value={companyQ}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCompanyQ(e.target.value)
              }
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Google / Microsoft / OpenAI"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Created From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDateFrom(e.target.value)
              }
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Created To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDateTo(e.target.value)
              }
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-6 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="mt-6 text-red-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-12 text-center text-gray-500 dark:text-slate-400">
          No profiles match your filters.
        </div>
      ) : (
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="p-3 text-left w-10"></th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Company</th>
                <th className="p-3 text-left">Region</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p: LinkedInProfile) => (
                <ProfileRow
                  key={p.id || p.profile_url}
                  profile={p}
                  handleCopy={handleCopy}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
