import React, { useCallback, useEffect, useState } from 'react';
import { LinkedInProfile, ScraperState } from '../types';
import {
  scrapeLinkedInProfiles,
  scrapeCompany,
  mapApifyToLinkedInProfile,
} from '../services/apify';
import {
  saveProfile,
  saveLead,
  fetchAllProfiles,
  fetchAllLeads,
  isApiReady,
} from '../services/api';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  CloudArrowUpIcon,
  CircleStackIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import ProfileCard from '../components/ProfileCard';
import { TableRowSkeleton, CardSkeleton } from '../components/Skeleton';

export default function Home() {
  const [scrapeMode, setScrapeMode] = useState<'profiles' | 'company'>('profiles');


  // Profile Scrape State
  const [urls, setUrls] = useState<string>('');

  // Company Scrape State
  const [companyUrl, setCompanyUrl] = useState<string>('');
  const [maxItems, setMaxItems] = useState<number>(10);
  const [profileScraperMode, setProfileScraperMode] = useState<string>('Full ($8 per 1k)');
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [yearsAtCurrentCompany, setYearsAtCurrentCompany] = useState<Set<string>>(new Set());
  const [yearsOfExperience, setYearsOfExperience] = useState<Set<string>>(new Set());

  // Input helpers
  const addJobTitle = () => {
    if (jobTitleInput.trim()) {
      setJobTitles([...jobTitles, jobTitleInput.trim()]);
      setJobTitleInput('');
    }
  };
  const removeJobTitle = (i: number) => setJobTitles(jobTitles.filter((_, idx) => idx !== i));
  const addLocation = () => {
    if (locationInput.trim()) {
      setLocations([...locations, locationInput.trim()]);
      setLocationInput('');
    }
  };
  const removeLocation = (i: number) => setLocations(locations.filter((_, idx) => idx !== i));
  const toggleSet = (set: Set<string>, val: string) => {
    const next = new Set(set);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    return next;
  };
  const [state, setState] = useState<ScraperState>({
    isLoading: false,
    error: null,
    results: [],
  });
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState<number>(0);
  const [savedLeadsCount, setSavedLeadsCount] = useState<number>(0);

  const previewTbodyRef = React.useRef<HTMLTableSectionElement>(null);

  useGSAP(() => {
    if (previewItems.length > 0) {
      gsap.from(previewTbodyRef.current?.children || [], {
        opacity: 0,
        y: 20,
        stagger: 0.05,
        duration: 0.5,
        ease: "power2.out"
      });
    }
  }, { dependencies: [previewItems] });

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch { }
  };

  const loadCount = useCallback(async () => {
    if (!isApiReady) return;
    try {
      const [profiles, leadsResponse] = await Promise.all([fetchAllProfiles(), fetchAllLeads()]);
      setSavedCount(profiles.length);
      setSavedLeadsCount(leadsResponse.total);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();

    let items: any[] = [];

    // Reset state
    setState((prev: ScraperState) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      if (scrapeMode === 'profiles') {
        const urlList = urls
          .split('\n')
          .map((u: string) => u.trim())
          .filter((u: string) => u.startsWith('http'));

        if (urlList.length === 0) {
          throw new Error('Please enter at least one valid LinkedIn URL');
        }
        items = await scrapeLinkedInProfiles(urlList);
        setUrls('');
      } else {
        // Company mode
        if (!companyUrl.trim().startsWith('http')) {
          throw new Error('Please enter a valid Company LinkedIn URL');
        }
        items = await scrapeCompany({
          companyUrl: companyUrl.trim(),
          maxItems,
          profileScraperMode,
          jobTitles,
          locations,
          yearsAtCurrentCompanyIds: Array.from(yearsAtCurrentCompany),
          yearsOfExperienceIds: Array.from(yearsOfExperience),
        });
      }

      setPreviewItems(items || []);
      setSelectedIndexes(new Set(items.map((_: any, i: number) => i)));
      setState((prev: ScraperState) => ({ ...prev, isLoading: false }));
    } catch (err: any) {
      setState((prev: ScraperState) => ({
        ...prev,
        isLoading: false,
        error: err.message,
      }));
    }
  };

  const toggleSelect = (idx: number) => {
    setSelectedIndexes((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const clearPreview = () => {
    setPreviewItems([]);
    setSelectedIndexes(new Set());
  };

  const importSelected = async () => {
    if (!isApiReady) {
      alert('API is not configured.');
      return;
    }
    const toImport = previewItems
      .map((item: any, idx: number) => ({ item, idx }))
      .filter(({ idx }) => selectedIndexes.has(idx))
      .map(({ item }: { item: any }) => mapApifyToLinkedInProfile(item));
    if (toImport.length === 0) {
      alert('No rows selected.');
      return;
    }
    try {
      if (scrapeMode === 'profiles') {
        await Promise.all(toImport.map((p: LinkedInProfile) => saveProfile(p)));
      } else {
        // Company mode leads
        await Promise.all(toImport.map((p: LinkedInProfile) => saveLead(p, companyUrl.trim())));
      }
      await loadCount();
      clearPreview();
    } catch (e: any) {
      alert('Import failed: ' + (e?.message || 'unknown error'));
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold dark:text-white mb-4 flex items-center gap-2">
              <CloudArrowUpIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Scrape New Profiles
            </h2>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700 mb-4">
              <button
                className={`py-2 px-4 text-sm font-medium ${scrapeMode === 'profiles'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                onClick={() => setScrapeMode('profiles')}
              >
                Profile URLs
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium ${scrapeMode === 'company'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                onClick={() => setScrapeMode('company')}
              >
                Company Search
              </button>
            </div>

            <form onSubmit={handleScrape} className="space-y-4">
              {scrapeMode === 'profiles' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profile URLs (One per line)
                  </label>
                  <textarea
                    disabled={state.isLoading}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="https://www.linkedin.com/in/..."
                    value={urls}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setUrls(e.target.value)
                    }
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Company URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Company LinkedIn URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={state.isLoading}
                      className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="https://www.linkedin.com/company/google"
                      value={companyUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCompanyUrl(e.target.value)
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Max Items */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Max Items <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        disabled={state.isLoading}
                        className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        value={maxItems}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setMaxItems(Number(e.target.value))
                        }
                      />
                    </div>
                    {/* Scraper Mode */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Scraper Mode <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={profileScraperMode}
                        onChange={(e) => setProfileScraperMode(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        disabled={state.isLoading}
                      >
                        <option value="Full + email search ($12 per 1k)">
                          Full + email search ($12 per 1k)
                        </option>
                        <option value="Full ($8 per 1k)">Full ($8 per 1k)</option>
                        <option value="Short ($4 per 1k)">Short ($4 per 1k)</option>
                      </select>
                    </div>
                  </div>

                  {/* Job Titles */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Job Titles (Keywords)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        value={jobTitleInput}
                        onChange={(e) => setJobTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addJobTitle())}
                        className="flex-1 p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. CEO"
                        disabled={state.isLoading}
                      />
                      <button
                        type="button"
                        onClick={addJobTitle}
                        disabled={state.isLoading}
                        className="px-3 py-1 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-sm font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 dark:text-slate-200"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {jobTitles.map((t, i) => (
                        <span
                          key={i}
                          className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded flex items-center gap-1"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeJobTitle(i)}
                            className="hover:text-blue-900 dark:hover:text-blue-100"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Locations */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Locations
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                        className="flex-1 p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Guangzhou"
                        disabled={state.isLoading}
                      />
                      <button
                        type="button"
                        onClick={addLocation}
                        disabled={state.isLoading}
                        className="px-3 py-1 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-sm font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 dark:text-slate-200"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {locations.map((t, i) => (
                        <span
                          key={i}
                          className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded flex items-center gap-1"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeLocation(i)}
                            className="hover:text-green-900 dark:hover:text-green-100"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Filters Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Years at Current Company */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                        Years at Current Company
                      </label>
                      <div className="space-y-1">
                        {[
                          { id: '1', label: 'Less than 1 year' },
                          { id: '2', label: '1 to 2 years' },
                          { id: '3', label: '3 to 5 years' },
                          { id: '4', label: '6 to 10 years' },
                          { id: '5', label: '> 10 years' },
                        ].map((opt) => (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={yearsAtCurrentCompany.has(opt.id)}
                              onChange={() =>
                                setYearsAtCurrentCompany(toggleSet(yearsAtCurrentCompany, opt.id))
                              }
                              disabled={state.isLoading}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Years of Experience */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                        Years of Experience
                      </label>
                      <div className="space-y-1">
                        {[
                          { id: '1', label: 'Less than 1 year' },
                          { id: '2', label: '1 to 2 years' },
                          { id: '3', label: '3 to 5 years' },
                          { id: '4', label: '6 to 10 years' },
                          { id: '5', label: '> 10 years' },
                        ].map((opt) => (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={yearsOfExperience.has(opt.id)}
                              onChange={() =>
                                setYearsOfExperience(toggleSet(yearsOfExperience, opt.id))
                              }
                              disabled={state.isLoading}
                              className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={state.isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {state.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    {scrapeMode === 'profiles' ? 'Scraping via Apify...' : 'Searching Company...'}
                  </>
                ) : (
                  'Start Scraping'
                )}
              </button>
            </form>
            {state.error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800">
                {state.error}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CircleStackIcon className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                Database Stats
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-4 rounded-lg text-white">
                <div className="text-3xl font-bold">{savedCount}</div>
                <div className="text-sm text-blue-100 font-medium">Saved Profiles</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-4 rounded-lg text-white">
                <div className="text-3xl font-bold">{savedLeadsCount}</div>
                <div className="text-sm text-emerald-100 font-medium">Saved Leads</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {previewItems.length > 0 ? 'Preview from Apify' : 'Ready to scrape'}
            </h2>
          </div>

          {previewItems.length === 0 ? (
            state.isLoading ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
                <CardSkeleton count={3} />
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 mb-4">
                  <MagnifyingGlassIcon className="h-8 w-8 text-blue-400 dark:text-blue-500" />
                </div>
                <p className="text-gray-900 dark:text-white font-semibold mb-2">Ready to Scrape</p>
                <p className="text-gray-500 dark:text-slate-400 text-sm">
                  Enter LinkedIn URLs or search a company to get started
                </p>
              </div>
            )
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="p-4 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-700">
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {selectedIndexes.size} selected / {previewItems.length} total
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedIndexes(new Set(previewItems.map((_: any, i: number) => i)))
                    }
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedIndexes(new Set())}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-200"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={clearPreview}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-200"
                  >
                    Discard Preview
                  </button>
                  <button
                    onClick={importSelected}
                    disabled={!isApiReady || selectedIndexes.size === 0}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    Import Selected
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="p-3 w-10"></th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Title</th>
                      <th className="p-3 text-left">Company</th>
                      <th className="p-3 text-left">Region</th>
                      <th className="p-3 text-left">Email</th>
                      <th className="p-3 text-left">Phone</th>
                      <th className="p-3 text-left">LinkedIn</th>
                    </tr>
                  </thead>
                  <tbody ref={previewTbodyRef}>
                    {state.isLoading ? (
                      <TableRowSkeleton count={3} />
                    ) : (
                      previewItems.map((item: any, idx: number) => {
                        const profile = mapApifyToLinkedInProfile(item);
                        return (
                          <tr
                            key={idx}
                            className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedIndexes.has(idx)}
                                onChange={() => toggleSelect(idx)}
                                className="rounded border-gray-300 dark:border-slate-500 text-blue-600 bg-white dark:bg-slate-600 cursor-pointer"
                              />
                            </td>
                            <ProfileCard profile={profile} handleCopy={handleCopy} />
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {!isApiReady && (
                <div className="p-4 bg-amber-50 border-t border-amber-200 text-amber-800 text-sm">
                  To import into database, please configure DATABASE_URL in your environment.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
