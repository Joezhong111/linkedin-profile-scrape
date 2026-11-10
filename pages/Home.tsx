import React, { useCallback, useEffect, useState } from 'react';
import { LinkedInProfile, ScraperState } from '@/types';
import {
  scrapeLinkedInProfiles,
  scrapeCompany,
  mapApifyToLinkedInProfile,
  checkCompanyHistory,
  checkScrapeStatus,
  CompanyHistoryResponse,
  ScrapeCompanyOptions,
  ScrapeCompanyResult,
  ScrapeTier,
} from '@/services/apify';
import {
  saveProfile,
  saveLead,
  fetchAllProfiles,
  fetchAllLeads,
} from '@/services/api';
import { authClient } from '@/lib/auth';
import { getCredentialStatus, type CredentialStatus } from '@/services/account';
import {
  COMPANY_URL_PATTERN,
  DEFAULT_MAX_ITEMS,
  FILTER_LIMITS,
  MAX_ITEMS,
  MAX_PROFILE_URLS,
  isProfileUrl,
} from '@/lib/scrape-config';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  CloudArrowUpIcon,
  CircleStackIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import ProfileCard from '@/components/ProfileCard';
import { TableRowSkeleton, CardSkeleton } from '@/components/Skeleton';

const COMPANY_POLL_INTERVAL_MS = 3000;
const COMPANY_POLL_MAX_ATTEMPTS = 200;

interface StoredCompanyJob {
  jobId: string;
  companyUrl: string;
}

/** Active job ids are stored per User so a reload resumes the same poll. */
function companyJobStorageKey(): string | null {
  const userId = authClient.getUser()?.id;
  return userId ? `lps.active-company-job.${userId}` : null;
}

function readStoredCompanyJob(): StoredCompanyJob | null {
  const key = companyJobStorageKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if ('jobId' in parsed && 'companyUrl' in parsed) {
      const { jobId, companyUrl } = parsed;
      if (typeof jobId === 'string' && typeof companyUrl === 'string') {
        return { jobId, companyUrl };
      }
    }
  } catch {
    // A corrupt entry must not block a new scrape.
  }
  return null;
}

function storeCompanyJob(value: StoredCompanyJob): void {
  const key = companyJobStorageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or denied; polling still works until reload.
  }
}

function clearStoredCompanyJob(): void {
  const key = companyJobStorageKey();
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; the in-memory poll state is authoritative.
  }
}

/** Splits the textarea into scrapeable URLs, mirroring the server-side filter. */
function parseProfileUrls(value: string): string[] {
  return value
    .split('\n')
    .map((url) => url.trim())
    .filter(isProfileUrl);
}

export default function Home() {
  const [scrapeMode, setScrapeMode] = useState<'profiles' | 'company'>('profiles');
  const [credential, setCredential] = useState<CredentialStatus | null>(null);
  const credentialReady = Boolean(credential?.configured);
  const filterLimit =
    credential?.provider === 'treg' ? FILTER_LIMITS.treg : FILTER_LIMITS.apify;


  // Profile Scrape State
  const [urls, setUrls] = useState<string>('');
  const [profileTier, setProfileTier] = useState<ScrapeTier>('full');
  const profileUrlCount = parseProfileUrls(urls).length;

  // Company Scrape State
  const [companyUrl, setCompanyUrl] = useState<string>('');
  const [maxItems, setMaxItems] = useState<number>(DEFAULT_MAX_ITEMS);
  const [tier, setTier] = useState<ScrapeTier>('full');
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [yearsAtCurrentCompany, setYearsAtCurrentCompany] = useState<Set<string>>(new Set());
  const [yearsOfExperience, setYearsOfExperience] = useState<Set<string>>(new Set());

  // Input helpers
  const addJobTitle = () => {
    if (!jobTitleInput.trim()) return;
    if (jobTitles.length >= filterLimit) {
      setState((prev: ScraperState) => ({
        ...prev,
        error: `At most ${filterLimit} job titles can be used per company scrape.`,
      }));
      return;
    }
    setJobTitles([...jobTitles, jobTitleInput.trim()]);
    setJobTitleInput('');
  };
  const removeJobTitle = (i: number) => setJobTitles(jobTitles.filter((_, idx) => idx !== i));
  const addLocation = () => {
    if (!locationInput.trim()) return;
    if (locations.length >= filterLimit) {
      setState((prev: ScraperState) => ({
        ...prev,
        error: `At most ${filterLimit} locations can be used per company scrape.`,
      }));
      return;
    }
    setLocations([...locations, locationInput.trim()]);
    setLocationInput('');
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

  // Warning Modal State
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [historyData, setHistoryData] = useState<CompanyHistoryResponse | null>(null);
  const [pendingScrapeOptions, setPendingScrapeOptions] = useState<any>(null);

  // Scrape Stats State
  const [scrapeStats, setScrapeStats] = useState<ScrapeCompanyResult['stats'] | null>(null);

  // Scraping status message
  const [scrapingStatus, setScrapingStatus] = useState<string>('');

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
    } catch {
      // Clipboard access can be denied; copying is best-effort.
    }
  };

  const loadCount = useCallback(async () => {
    try {
      const [profiles, leadsResponse] = await Promise.all([fetchAllProfiles(), fetchAllLeads()]);
      setSavedCount(profiles.length);
      setSavedLeadsCount(leadsResponse.total);
    } catch {
      // ignore
    }
  }, []);

  const buildCompanyOptions = (): ScrapeCompanyOptions => ({
    companyUrl: companyUrl.trim(),
    maxItems,
    tier,
    jobTitles,
    locations,
    yearsAtCurrentCompanyIds: Array.from(yearsAtCurrentCompany),
    yearsOfExperienceIds: Array.from(yearsOfExperience),
  });

  /**
   * Polls one job until it succeeds or fails, updating progress on the way.
   * Every successful or failed terminal state clears the persisted job id.
   */
  const pollCompanyJob = useCallback(async (jobId: string) => {
    setState((prev: ScraperState) => ({ ...prev, isLoading: true, error: null }));
    setScrapingStatus('Company scrape started — waiting for the provider...');

    for (let attempt = 0; attempt < COMPANY_POLL_MAX_ATTEMPTS; attempt += 1) {
      // The app tsconfig targets ES2023, so Promise.withResolvers is unavailable.
      await new Promise<void>((resolve) => setTimeout(resolve, COMPANY_POLL_INTERVAL_MS));

      let statusResult: ScrapeCompanyResult;
      try {
        statusResult = await checkScrapeStatus(jobId);
      } catch (err: any) {
        clearStoredCompanyJob();
        setScrapingStatus('');
        setState((prev: ScraperState) => ({
          ...prev,
          isLoading: false,
          error: err?.message || 'Could not check the company scrape status.',
        }));
        return;
      }

      if (statusResult.status === 'succeeded') {
        const items = statusResult.items || [];
        setPreviewItems(items);
        setSelectedIndexes(new Set(items.map((_: unknown, i: number) => i)));
        setScrapeStats(statusResult.stats || null);
        clearStoredCompanyJob();
        setScrapingStatus('');
        setState((prev: ScraperState) => ({ ...prev, isLoading: false, error: null }));
        return;
      }

      if (statusResult.status === 'failed') {
        clearStoredCompanyJob();
        setScrapingStatus('');
        setState((prev: ScraperState) => ({
          ...prev,
          isLoading: false,
          error: statusResult.error || 'The company scrape failed. Try again.',
        }));
        return;
      }

      const found = statusResult.progress ?? statusResult.resultCount ?? 0;
      setScrapingStatus(
        `Scraping company... ${found} profile${found === 1 ? '' : 's'} found so far`
      );
    }

    clearStoredCompanyJob();
    setScrapingStatus('');
    setState((prev: ScraperState) => ({
      ...prev,
      isLoading: false,
      error: 'Company scraping timed out. Please try again.',
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCredentialStatus()
      .then((status) => {
        if (!cancelled) setCredential(status);
      })
      .catch(() => {
        if (!cancelled) setCredential(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  // Resume an in-flight company job after a reload; only once per mount.
  const resumedCompanyJob = React.useRef(false);
  useEffect(() => {
    if (!credentialReady || resumedCompanyJob.current) return;
    resumedCompanyJob.current = true;
    const stored = readStoredCompanyJob();
    if (!stored) return;
    setScrapeMode('company');
    setCompanyUrl(stored.companyUrl);
    void pollCompanyJob(stored.jobId);
  }, [credentialReady, pollCompanyJob]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset stats
    setScrapeStats(null);

    if (!credentialReady) {
      setState((prev: ScraperState) => ({
        ...prev,
        error: 'Configure a Scrape Credential in Settings before scraping.',
      }));
      return;
    }

    // Company mode: validate locally, then check history
    if (scrapeMode === 'company') {
      if (!COMPANY_URL_PATTERN.test(companyUrl.trim())) {
        setState((prev: ScraperState) => ({
          ...prev,
          error: 'Please enter a valid Company LinkedIn URL (linkedin.com/company/...)',
        }));
        return;
      }
      if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_ITEMS) {
        setState((prev: ScraperState) => ({
          ...prev,
          error: `Max items must be an integer from 1 to ${MAX_ITEMS}.`,
        }));
        return;
      }

      try {
        const history = await checkCompanyHistory(companyUrl.trim());
        if (history.hasHistory) {
          // Show warning modal
          setHistoryData(history);
          setPendingScrapeOptions(buildCompanyOptions());
          setShowWarningModal(true);
          return;
        }
      } catch (err: any) {
        console.error('Failed to check company history:', err);
        // Continue with scraping even if history check fails
      }
    }

    // Proceed with scraping
    await performScrape();
  };

  const performScrape = async () => {
    let result: any;

    if (!credentialReady) {
      setState((prev: ScraperState) => ({
        ...prev,
        error: 'Configure a Scrape Credential in Settings before scraping.',
      }));
      return;
    }

    // Reset state
    setState((prev: ScraperState) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      if (scrapeMode === 'profiles') {
        const urlList = parseProfileUrls(urls);

        if (urlList.length === 0) {
          throw new Error('Please enter at least one valid LinkedIn URL');
        }
        if (urlList.length > MAX_PROFILE_URLS) {
          throw new Error(
            `You can scrape at most ${MAX_PROFILE_URLS} Profile URLs at a time.`
          );
        }
        result = await scrapeLinkedInProfiles(
          urlList,
          credential?.provider === 'treg' ? profileTier : 'full'
        );
        const items = result || [];
        setPreviewItems(items);
        setSelectedIndexes(new Set(items.map((_: any, i: number) => i)));
        setUrls('');
      } else {
        // Company mode: start a job, persist its id, then poll by job id.
        const options: ScrapeCompanyOptions = pendingScrapeOptions || buildCompanyOptions();

        if (!Number.isInteger(options.maxItems) || options.maxItems < 1 || options.maxItems > MAX_ITEMS) {
          throw new Error(`Max items must be an integer from 1 to ${MAX_ITEMS}.`);
        }

        const started = await scrapeCompany(options);
        if (!started.jobId) {
          throw new Error('The server did not return a Scrape Job id.');
        }

        storeCompanyJob({ jobId: started.jobId, companyUrl: options.companyUrl });
        await pollCompanyJob(started.jobId);
      }

      setState((prev: ScraperState) => ({ ...prev, isLoading: false }));
    } catch (err: any) {
      setState((prev: ScraperState) => ({
        ...prev,
        isLoading: false,
        error: err.message,
      }));
    } finally {
      setPendingScrapeOptions(null);
    }
  };

  const handleContinueScrape = () => {
    setShowWarningModal(false);
    performScrape();
  };

  const handleCancelScrape = () => {
    setShowWarningModal(false);
    setPendingScrapeOptions(null);
    setHistoryData(null);
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
      {/* Warning Modal */}
      {showWarningModal && historyData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCancelScrape}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⚠️ 重复抓取警告
            </h3>
            <div className="space-y-3 text-sm text-gray-700 dark:text-slate-300">
              <p>
                你已经抓取过这个公司 <strong>{historyData.totalScrapes}</strong> 次。
              </p>
              {historyData.lastScrape && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                  <p className="font-semibold text-blue-900 dark:text-blue-200 mb-2">上次抓取信息：</p>
                  <ul className="space-y-1 text-blue-800 dark:text-blue-300">
                    <li>• 时间：{new Date(historyData.lastScrape.scrapedAt).toLocaleString('zh-CN')}</li>
                    <li>• 请求数量：{historyData.lastScrape.maxItemsRequested}</li>
                    <li>• 实际返回：{historyData.lastScrape.itemsReturned}</li>
                    <li>• 保存到数据库：{historyData.lastScrape.itemsSaved}</li>
                  </ul>
                </div>
              )}
              <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg">
                <p className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">⚠️ 重要提示：</p>
                <ul className="space-y-1 text-yellow-800 dark:text-yellow-300 text-xs">
                  <li>• LinkedIn 员工列表会动态变化（新员工加入、离职、排序变化）</li>
                  <li>• 重复抓取可能获取到相同的 profiles</li>
                  <li>• Apify 按实际返回数量收费，即使数据重复</li>
                  <li>• 系统会自动去重，只保存新的 profiles 到数据库</li>
                </ul>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                <p className="font-semibold text-green-900 dark:text-green-200 mb-1">💡 建议：</p>
                <p className="text-green-800 dark:text-green-300 text-xs">
                  建议直接获取你需要的最大数量，避免多次调用造成重复和费用浪费。
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancelScrape}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleContinueScrape}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                继续抓取
              </button>
            </div>
          </div>
        </div>
      )}

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

            {credential?.provider && (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 px-3 py-2 text-sm text-gray-700 dark:text-slate-300">
                <span>
                  Active Provider:{' '}
                  <strong className="font-semibold capitalize text-gray-900 dark:text-white">
                    {credential.provider}
                  </strong>
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  read-only — change it in Settings
                </span>
              </div>
            )}

            {credential && !credentialReady && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm rounded-lg border border-amber-100 dark:border-amber-800 flex items-start gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Scraping is disabled until you add a Scrape Credential.{' '}
                  <a href="#/settings" className="font-semibold underline">
                    Open Settings
                  </a>
                </span>
              </div>
            )}

            <form onSubmit={handleScrape} className="space-y-4">
              {scrapeMode === 'profiles' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profile URLs (One per line, max {MAX_PROFILE_URLS})
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
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={
                        profileUrlCount > MAX_PROFILE_URLS
                          ? 'font-semibold text-red-600 dark:text-red-400'
                          : 'text-gray-500 dark:text-slate-400'
                      }
                    >
                      {profileUrlCount}/{MAX_PROFILE_URLS} URLs
                      {profileUrlCount > MAX_PROFILE_URLS
                        ? ' — remove URLs to continue'
                        : ''}
                    </span>
                    {credential?.provider === 'apify' && (
                      <span className="text-gray-500 dark:text-slate-400">
                        Fixed Full — attempts email and phone
                      </span>
                    )}
                  </div>

                  {credential?.provider === 'treg' && (
                    <div className="mt-3 space-y-2">
                      <label
                        htmlFor="profile-tier"
                        className="block text-sm font-medium text-gray-700 dark:text-slate-300"
                      >
                        Profile tier
                      </label>
                      <select
                        id="profile-tier"
                        value={profileTier}
                        onChange={(e) => setProfileTier(e.target.value as ScrapeTier)}
                        disabled={state.isLoading}
                        className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="full">Full</option>
                        <option value="full_email">Full+email</option>
                      </select>
                      <div className="rounded-lg border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                        <ul className="list-disc space-y-1 pl-4">
                          {profileTier === 'full_email' && (
                            <li>Full+email may take around two minutes per batch.</li>
                          )}
                          <li>treg never returns a phone number.</li>
                          <li>treg email is optional and often missing.</li>
                        </ul>
                      </div>
                    </div>
                  )}
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
                        max={MAX_ITEMS}
                        disabled={state.isLoading}
                        className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        value={maxItems}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setMaxItems(Number(e.target.value))
                        }
                      />
                    </div>
                    {/* Scrape Tier */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Scrape Tier <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={tier}
                        onChange={(e) => {
                          if (e.target.value === 'full' || e.target.value === 'full_email') {
                            setTier(e.target.value);
                          }
                        }}
                        className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        disabled={state.isLoading}
                      >
                        <option value="full">Full ($8 per 1k)</option>
                        <option value="full_email">Full + email search ($12 per 1k)</option>
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
                disabled={
                  state.isLoading ||
                  !credentialReady ||
                  (scrapeMode === 'profiles' &&
                    (profileUrlCount === 0 || profileUrlCount > MAX_PROFILE_URLS)) ||
                  (scrapeMode === 'company' &&
                    (!COMPANY_URL_PATTERN.test(companyUrl.trim()) ||
                      !Number.isInteger(maxItems) ||
                      maxItems < 1 ||
                      maxItems > MAX_ITEMS))
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {state.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    {scrapeMode === 'profiles'
                      ? `Scraping via ${credential?.provider === 'treg' ? 'treg' : 'Apify'}...`
                      : 'Searching Company...'}
                  </>
                ) : (
                  'Start Scraping'
                )}
              </button>

              {/* Scraping Status Message */}
              {scrapingStatus && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-lg border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                    <span>{scrapingStatus}</span>
                  </div>
                </div>
              )}
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
              {/* Stats Display */}
              {scrapeStats && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-900 dark:text-blue-200 font-semibold text-sm">📊 去重统计</span>
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    获取了 <strong>{scrapeStats.totalReturned}</strong> 个 profiles，
                    其中 <strong>{scrapeStats.alreadyExists}</strong> 个已存在
                    (<strong>{scrapeStats.duplicateRate}%</strong>)，
                    <strong>{scrapeStats.newProfiles}</strong> 个是新的
                  </div>
                </div>
              )}
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
                    disabled={selectedIndexes.size === 0}
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
