
import React, { useState, useEffect, useCallback } from 'react';
import { LinkedInProfile, ScraperState } from './types';
import { scrapeLinkedInProfiles } from './services/apify';
import { saveProfile, fetchAllProfiles, deleteProfile, updateProfileAI, isSupabaseReady } from './services/supabase';
import { analyzeProfile } from './services/gemini';
import { 
  MagnifyingGlassIcon, 
  TrashIcon, 
  SparklesIcon, 
  ArrowTopRightOnSquareIcon,
  CircleStackIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

export default function App() {
  const [urls, setUrls] = useState<string>('');
  const [state, setState] = useState<ScraperState>({
    isLoading: false,
    error: null,
    results: []
  });
  const [savedProfiles, setSavedProfiles] = useState<LinkedInProfile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);

  const apifyToken = process.env.APIFY_TOKEN;
  const isApifyReady = Boolean(apifyToken);

  const loadData = useCallback(async () => {
    if (!isSupabaseReady) return;
    try {
      const data = await fetchAllProfiles();
      setSavedProfiles(data);
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApifyReady || !isSupabaseReady) {
      setState(prev => ({ ...prev, error: 'Environment variables (Apify or Supabase) are missing.' }));
      return;
    }

    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    
    if (urlList.length === 0) {
      setState(prev => ({ ...prev, error: 'Please enter at least one valid LinkedIn URL' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const scraped = await scrapeLinkedInProfiles(urlList);
      
      // Save to Supabase
      const savePromises = scraped.map(profile => saveProfile(profile));
      await Promise.all(savePromises);
      
      await loadData();
      setUrls('');
      setState(prev => ({ ...prev, isLoading: false, results: scraped }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, error: err.message }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this profile from database?')) return;
    try {
      await deleteProfile(id);
      await loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleAIAnalysis = async (profile: LinkedInProfile) => {
    if (!profile.id) return;
    setIsAnalyzing(profile.id);
    try {
      const summary = await analyzeProfile(profile);
      await updateProfileAI(profile.id, summary);
      await loadData();
    } catch (err: any) {
      alert('AI Analysis failed');
    } finally {
      setIsAnalyzing(null);
    }
  };

  return (
    <div className="min-h-screen pb-12 bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <MagnifyingGlassIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">LinkedIn Insights Pro</h1>
          </div>
          <div className="flex items-center space-x-6 text-sm font-medium">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Apify:</span>
              {isApifyReady ? (
                <span className="text-green-600 flex items-center gap-1"><CheckCircleIcon className="h-4 w-4"/> Ready</span>
              ) : (
                <span className="text-red-500 flex items-center gap-1"><ExclamationTriangleIcon className="h-4 w-4"/> Missing</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Supabase:</span>
              {isSupabaseReady ? (
                <span className="text-green-600 flex items-center gap-1"><CheckCircleIcon className="h-4 w-4"/> Connected</span>
              ) : (
                <span className="text-red-500 flex items-center gap-1"><ExclamationTriangleIcon className="h-4 w-4"/> Disconnected</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {(!isApifyReady || !isSupabaseReady) && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-4 shadow-sm animate-pulse">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-800">Environment Configuration Needed</h3>
              <p className="text-sm text-amber-700 mt-1">
                To enable all features, please set the following environment variables in your project settings:
                <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded text-amber-900">APIFY_TOKEN</code>, 
                <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded text-amber-900">SUPABASE_URL</code>, and 
                <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded text-amber-900">SUPABASE_ANON_KEY</code>.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form & Stats */}
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
                    disabled={!isApifyReady || !isSupabaseReady}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="https://www.linkedin.com/in/..."
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={state.isLoading || !isApifyReady || !isSupabaseReady}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {state.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Scraping via Apify...
                    </>
                  ) : (
                    'Start Scraping'
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
                  <div className="text-2xl font-bold text-gray-900">{savedProfiles.length}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Saved</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {savedProfiles.filter(p => p.ai_summary).length}
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">AI Summarized</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Profile Feed */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Captured Profiles</h2>
              {savedProfiles.length > 0 && (
                <span className="text-xs font-medium text-gray-400">Showing {savedProfiles.length} records</span>
              )}
            </div>
            
            {!isSupabaseReady ? (
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                <CircleStackIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Supabase Connection Required</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">Please provide your Supabase URI and Key in the environment to enable persistent storage.</p>
              </div>
            ) : savedProfiles.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No profiles saved in database.</p>
                <p className="text-sm text-gray-400 mt-1">Submit LinkedIn URLs on the left to start harvesting insights.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedProfiles.map((profile) => (
                  <ProfileCard 
                    key={profile.id} 
                    profile={profile} 
                    onDelete={handleDelete}
                    onAnalyze={handleAIAnalysis}
                    isAnalyzing={isAnalyzing === profile.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const ProfileCard: React.FC<{
  profile: LinkedInProfile; 
  onDelete: (id: string) => void;
  onAnalyze: (profile: LinkedInProfile) => void;
  isAnalyzing: boolean;
}> = ({ profile, onDelete, onAnalyze, isAnalyzing }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <img 
            src={profile.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=random`} 
            alt={profile.full_name}
            className="h-16 w-16 rounded-full object-cover border-2 border-gray-100 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=random`;
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 truncate">{profile.full_name}</h3>
              <div className="flex items-center space-x-1">
                <a 
                  href={profile.profile_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="View Original Profile"
                >
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                </a>
                <button 
                  onClick={() => onDelete(profile.id!)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove from Database"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <p className="text-sm text-blue-600 font-medium leading-snug mb-1">{profile.headline}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
              {profile.location || 'Location Not Specified'}
            </p>
          </div>
        </div>

        {profile.about && (
          <div className="mt-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Professional Background</h4>
            <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{profile.about}</p>
          </div>
        )}

        {/* AI Analysis Section */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          {profile.ai_summary ? (
            <div className="bg-blue-50/40 rounded-lg p-4 border border-blue-100/50">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-800 uppercase tracking-widest">Gemini Intelligence</span>
              </div>
              <div className="text-sm text-gray-800 prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">
                {profile.ai_summary}
              </div>
              <button 
                onClick={() => onAnalyze(profile)}
                disabled={isAnalyzing}
                className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2"><div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" /> Updating...</span>
                ) : (
                  'Regenerate Analysis'
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAnalyze(profile)}
              disabled={isAnalyzing}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 font-semibold hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 group"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                  AI Analysis in progress...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  Generate Executive Summary
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
