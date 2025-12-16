import React, { useCallback, useEffect, useState } from "react";
import { LinkedInProfile, ScraperState } from "../types";
import {
  scrapeLinkedInProfiles,
  mapApifyToLinkedInProfile,
} from "../services/apify";
import {
  saveProfile,
  fetchAllProfiles,
  isSupabaseReady,
} from "../services/supabase";
import {
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import ProfileCard from "../components/ProfileCard";

export default function Home() {
  const [urls, setUrls] = useState<string>("");
  const [state, setState] = useState<ScraperState>({
    isLoading: false,
    error: null,
    results: [],
  });
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    new Set()
  );
  const [savedCount, setSavedCount] = useState<number>(0);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const apifyToken = import.meta.env.VITE_APIFY_TOKEN;
  const isApifyReady = Boolean(apifyToken); // used only to show hint in dev; UI not gated by it

  const loadCount = useCallback(async () => {
    if (!isSupabaseReady) return;
    try {
      const data = await fetchAllProfiles();
      setSavedCount(data.length);
    } catch (e) {
      // ignore in home
    }
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApifyReady) {
      setState((prev: ScraperState) => ({
        ...prev,
        error: "Apify token missing. Please set VITE_APIFY_TOKEN.",
      }));
      return;
    }
    const urlList = urls
      .split("\n")
      .map((u: string) => u.trim())
      .filter((u: string) => u.startsWith("http"));
    if (urlList.length === 0) {
      setState((prev: ScraperState) => ({
        ...prev,
        error: "Please enter at least one valid LinkedIn URL",
      }));
      return;
    }
    setState((prev: ScraperState) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));
    try {
      const items = await scrapeLinkedInProfiles(urlList);
      setPreviewItems(items || []);
      setSelectedIndexes(new Set(items.map((_: any, i: number) => i)));
      setUrls("");
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
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const clearPreview = () => {
    setPreviewItems([]);
    setSelectedIndexes(new Set());
  };

  const importSelected = async () => {
    if (!isSupabaseReady) {
      alert("Supabase is not configured.");
      return;
    }
    const toImport = previewItems
      .map((item: any, idx: number) => ({ item, idx }))
      .filter(({ idx }) => selectedIndexes.has(idx))
      .map(({ item }: { item: any }) => mapApifyToLinkedInProfile(item));
    if (toImport.length === 0) {
      alert("No rows selected.");
      return;
    }
    try {
      await Promise.all(toImport.map((p: LinkedInProfile) => saveProfile(p)));
      await loadCount();
      clearPreview();
    } catch (e: any) {
      alert("Import failed: " + (e?.message || "unknown error"));
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      {!isApifyReady && import.meta.env.DEV && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-4 shadow-sm">
          <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-800">Dev note</h3>
            <p className="text-sm text-amber-700 mt-1">
              In development, set{" "}
              <code className="px-1 py-0.5 bg-amber-100 rounded">
                VITE_APIFY_TOKEN
              </code>{" "}
              to use the local /api proxy. In production, serverless functions
              will handle the token.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CloudArrowUpIcon className="h-5 w-5 text-blue-600" />
              Scrape New Profiles
            </h2>
            <form onSubmit={handleScrape} className="space-y-4">
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
              <button
                type="submit"
                disabled={state.isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {state.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Scraping via Apify...
                  </>
                ) : (
                  "Start Scraping"
                )}
              </button>
            </form>
            {state.error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {state.error}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CircleStackIcon className="h-4 w-4 text-gray-500" />
                Database Stats
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {savedCount}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Total Saved
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">
                  Go to Profiles page to manage
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {previewItems.length > 0
                ? "Preview from Apify"
                : "Ready to scrape"}
            </h2>
          </div>

          {previewItems.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
              <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">
                Enter LinkedIn URLs and click Start Scraping.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 flex items-center justify-between gap-3 border-b border-gray-100">
                <div className="text-sm text-gray-600">
                  {selectedIndexes.size} selected / {previewItems.length} total
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedIndexes(
                        new Set(previewItems.map((_: any, i: number) => i))
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold border rounded-md hover:bg-gray-50"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedIndexes(new Set())}
                    className="px-3 py-1.5 text-xs font-semibold border rounded-md hover:bg-gray-50"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={clearPreview}
                    className="px-3 py-1.5 text-xs font-semibold border rounded-md hover:bg-gray-50"
                  >
                    Discard Preview
                  </button>
                  <button
                    onClick={importSelected}
                    disabled={!isSupabaseReady || selectedIndexes.size === 0}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    Import Selected
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
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
                  <tbody>
                    {previewItems.map((item: any, idx: number) => {
                      const profile = mapApifyToLinkedInProfile(item);
                      return (
                        <tr
                          key={idx}
                          className="border-t border-gray-100 hover:bg-gray-50"
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedIndexes.has(idx)}
                              onChange={() => toggleSelect(idx)}
                            />
                          </td>
                          <ProfileCard
                            profile={profile}
                            handleCopy={handleCopy}
                          />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!isSupabaseReady && (
                <div className="p-4 bg-amber-50 border-t border-amber-200 text-amber-800 text-sm">
                  To import into database, please configure VITE_SUPABASE_URL
                  and VITE_SUPABASE_ANON_KEY.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
