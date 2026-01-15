import React, { useEffect, useMemo, useState } from 'react';
import { LinkedInProfile } from '../types';

import { fetchAllProfiles } from '../services/api';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  BriefcaseIcon,
  MapPinIcon,
  EnvelopeIcon,
  CloudArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import ProfileRow from '../components/ProfileRow';
import { TableRowSkeleton } from '../components/Skeleton';

// --- CSV Helper ---
function toCsv(rows: LinkedInProfile[]) {
  const headers = [
    'id',
    'created_at',
    'profile_url',
    'full_name',
    'headline',
    'location',
    'about',
    'photo_url',
    'ai_summary',
  ];
  const esc = (v: any) => {
    const s = v === undefined || v === null ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [headers.join(',')];
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
      ].join(',')
    );
  }
  return lines.join('\n');
}

export default function Profiles() {
  // --- State ---
  const [all, setAll] = useState<LinkedInProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [aiOnly, setAiOnly] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [minFollowers, setMinFollowers] = useState<number>(0);
  const [industryQ, setIndustryQ] = useState('');
  const [companyQ, setCompanyQ] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasExp, setHasExp] = useState(false);
  const [hasEdu, setHasEdu] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'followers' | 'default'>('default');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Refs
  const tbodyRef = React.useRef<HTMLTableSectionElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // --- Derived Data ---
  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const p of all) {
      if (p.location) set.add(p.location);
    }
    return Array.from(set).sort();
  }, [all]);

  const clearFilters = () => {
    setQ('');
    setAiOnly(false);
    setHasEmail(false);
    setHasPhone(false);
    setMinFollowers(0);
    setIndustryQ('');
    setCompanyQ('');
    setLocationFilter('');
    setHasPhoto(false);
    setHasExp(false);
    setHasEdu(false);
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1); // Reset page on clear
  };

  // --- Effects ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const rows = await fetchAllProfiles();
        if (mounted) {
          setAll(rows);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Filter Logic
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTime = dateTo ? new Date(dateTo).getTime() + 86400000 - 1 : Infinity;

    return all.filter((p) => {
      const rd = p.raw_data || {};
      const followers = p.followers ?? rd.followers ?? 0;
      const emailVal = p.email ?? rd.email;
      const phoneVal = p.mobile_number ?? rd.mobileNumber;
      const industryVal = p.company_industry ?? rd.companyIndustry ?? '';
      const companyVal = p.company_name ?? rd.companyName ?? '';
      const loc = p.location ?? p.address_with_country ?? rd.addressWithCountry ?? '';

      // Boolean checks
      if (aiOnly && !p.ai_summary) return false;
      if (hasEmail && !emailVal) return false;
      if (hasPhone && !phoneVal) return false;
      if (hasPhoto && !p.photo_url) return false;

      // Numeric/String Logic checks
      if (minFollowers > 0 && followers < minFollowers) return false;
      if (industryQ && !String(industryVal).toLowerCase().includes(industryQ.toLowerCase())) return false;
      if (companyQ && !String(companyVal).toLowerCase().includes(companyQ.toLowerCase())) return false;
      if (locationFilter && loc !== locationFilter) return false;

      // Arrays
      const expList = p.experiences ?? rd.experiences ?? [];
      if (hasExp && expList.length === 0) return false;
      const eduList = p.education ?? rd.educations ?? [];
      if (hasEdu && eduList.length === 0) return false;

      // Date Range
      if (dateFrom || dateTo) {
        const created = p.created_at ? new Date(p.created_at).getTime() : NaN;
        if (!isNaN(created)) {
          if (created < fromTime || created > toTime) return false;
        }
      }

      // Search Term
      if (!term) return true;
      const hay = [
        p.full_name,
        p.headline,
        loc,
        companyVal,
        p.profile_url,
        p.about,
        p.ai_summary,
        String(industryVal),
      ]
        .map((v) => (v || '').toLowerCase())
        .join(' ');
      return hay.includes(term);
    });
  }, [
    all, q, aiOnly, hasEmail, hasPhone, minFollowers, industryQ, companyQ,
    locationFilter, hasPhoto, hasExp, hasEdu, dateFrom, dateTo
  ]);

  // Sorting
  const sorted = useMemo(() => {
    const base = [...filtered]; // Shallow copy
    if (sortBy === 'followers') {
      base.sort((a, b) => (b.followers || 0) - (a.followers || 0));
    } else if (sortBy === 'newest') {
      base.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return base;
  }, [filtered, sortBy]);

  // Pagination Logic
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filtered.length, sortBy]);

  const exportCsv = () => {
    const csv = toCsv(sorted);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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

  // Animation
  useGSAP(() => {
    if (!loading && paginatedData.length > 0 && tbodyRef.current) {
      gsap.fromTo(
        tbodyRef.current.children,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, stagger: 0.03, duration: 0.4, ease: "power2.out", clearProps: "all" }
      );
    }
  }, { dependencies: [paginatedData, loading] });

  // Render Helpers
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-slate-400">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, sorted.length)}</span> of{' '}
              <span className="font-medium">{sorted.length}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              {/* Simple page indicator for now - can be expanded to proper pagination numbers */}
              <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:outline-offset-0">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            Captured Profiles
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Manage and analyze your gathered LinkedIn data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#/"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            ← Back to Home
          </a>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CloudArrowUpIcon className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters Container - Glassmorphism */}
      <div className="mb-8 p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-semibold">
          <FunnelIcon className="h-5 w-5 text-blue-500" />
          <span>Filters & Search</span>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between mb-6">
          <div className="relative flex-1 group">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, headline, location, or logic..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={aiOnly}
                onChange={(e) => setAiOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center gap-1">
                <SparklesIcon className="h-4 w-4 text-amber-500" />
                AI Only
              </span>
            </label>

            <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-50/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <option value="default">Sort: Default</option>
              <option value="followers">Sort: Followers (High to Low)</option>
              <option value="newest">Sort: Newest First</option>
            </select>
          </div>
        </div>

        {/* Detailed Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full p-2 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Any Location</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Company</label>
            <input
              type="text"
              value={companyQ}
              onChange={(e) => setCompanyQ(e.target.value)}
              placeholder="Ex: Google"
              className="w-full p-2 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Industry</label>
            <input
              type="text"
              value={industryQ}
              onChange={(e) => setIndustryQ(e.target.value)}
              placeholder="Ex: Tech"
              className="w-full p-2 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Min Followers</label>
            <input
              type="number"
              value={minFollowers}
              onChange={(e) => setMinFollowers(Number(e.target.value))}
              placeholder="0"
              className="w-full p-2 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1 col-span-1 sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Data Requirements</label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setHasEmail(!hasEmail)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${hasEmail ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-transparent border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-blue-300'}`}
              >
                {hasEmail ? 'Has Email ✓' : 'Email?'}
              </button>
              <button
                onClick={() => setHasPhone(!hasPhone)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${hasPhone ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-transparent border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-blue-300'}`}
              >
                {hasPhone ? 'Has Phone ✓' : 'Phone?'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 underline decoration-dotted underline-offset-2 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-xl">
          <table className="min-w-full">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                {['', 'Name', 'Title', 'Company', 'Region', 'Contact', 'LinkedIn'].map((h, i) => (
                  <th key={i} className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider opacity-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <TableRowSkeleton count={8} />
            </tbody>
          </table>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-3">
            <span className="text-xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Failed to load profiles</h3>
          <p className="mt-1 text-red-600 dark:text-red-300 text-sm">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white/50 dark:bg-slate-900/50 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-3xl">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No profiles match your search</h3>
          <p className="mt-1 text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your filters or search terms.
          </p>
          <button
            onClick={clearFilters}
            className="mt-6 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div
            ref={tableContainerRef}
            className="hidden md:block bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur sticky top-0 z-10 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-4 text-center font-medium text-gray-500 dark:text-slate-400">#</th>
                    <th scope="col" className="px-3 py-4 font-semibold text-gray-900 dark:text-white">Name</th>
                    <th scope="col" className="px-3 py-4 font-semibold text-gray-900 dark:text-white">Title</th>
                    <th scope="col" className="px-3 py-4 font-semibold text-gray-900 dark:text-white">Company</th>
                    <th scope="col" className="px-3 py-4 font-semibold text-gray-900 dark:text-white">Region</th>
                    <th scope="col" className="px-3 py-4 font-semibold text-gray-900 dark:text-white">Email</th>
                    <th scope="col" className="px-3 py-4 font-semibold text-gray-900 dark:text-white">Phone</th>
                    <th scope="col" className="px-3 py-4 font-semibold text-gray-900 dark:text-white">Action</th>
                  </tr>
                </thead>
                <tbody ref={tbodyRef} className="divide-y divide-gray-100 dark:divide-slate-700/50 bg-transparent">
                  {paginatedData.map((p) => (
                    <ProfileRow key={p.id || p.profile_url} profile={p} handleCopy={handleCopy} />
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {paginatedData.map((p) => (
              <div key={p.id || p.profile_url} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={p.photo_url || p.profile_pic_high_quality || ''}
                    onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + p.full_name)}
                    className="h-10 w-10 rounded-full object-cover bg-gray-100"
                  />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{p.full_name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{p.headline}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400 mb-3">
                  <div className="flex items-center gap-1"><BriefcaseIcon className="h-3 w-3" /> {p.company_name || '-'}</div>
                  <div className="flex items-center gap-1"><MapPinIcon className="h-3 w-3" /> {p.location || '-'}</div>
                </div>
                {(p.email || p.mobile_number) && (
                  <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                    {p.email && (
                      <button onClick={() => handleCopy(p.email)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        <EnvelopeIcon className="h-3 w-3" /> Email
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {renderPagination()}
          </div>
        </>
      )}
    </main>
  );
}
