import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  clearCredential,
  getCredentialStatus,
  saveCredential,
  type CredentialStatus,
  type ProviderId,
} from '@/services/account';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  apify: 'Apify',
  treg: 'treg',
};

export default function Settings() {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [provider, setProvider] = useState<ProviderId>('apify');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getCredentialStatus();
      setStatus(next);
      if (next.provider) setProvider(next.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credential status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setWarning(null);

    if (!token.trim()) {
      setError('Enter a token before saving.');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveCredential(provider, token);
      setStatus({
        provider: saved.provider,
        configured: saved.configured,
        validatedAt: saved.validatedAt,
      });
      setToken('');
      setNotice(
        `${PROVIDER_LABELS[provider]} credential saved. ${
          provider === 'treg' ? 'It will be validated on the first scrape.' : ''
        }`.trim()
      );
      setWarning(saved.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setNotice(null);
    setWarning(null);
    setClearing(true);
    try {
      const cleared = await clearCredential();
      setStatus(cleared);
      setToken('');
      setNotice('Scrape credential cleared. Scraping is disabled until you add one.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear credential');
    } finally {
      setClearing(false);
    }
  };

  const configured = Boolean(status?.configured);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Scrapes use your own provider credential. It is encrypted at rest and never shown again
        after saving.
      </p>

      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Scrape Credential
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Active Provider
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {status?.provider ? PROVIDER_LABELS[status.provider] : 'None'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Status
            </div>
            {loading ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading…</span>
            ) : configured ? (
              <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4" /> Configured
              </span>
            ) : (
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-4 w-4" /> Missing
              </span>
            )}
          </div>
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Last Validated
            </div>
            <div className="text-sm text-gray-900 dark:text-white">
              {status?.validatedAt
                ? new Date(status.validatedAt).toLocaleString()
                : status?.configured
                  ? 'Not yet (validated on first scrape)'
                  : '—'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="credential-provider"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Provider
            </label>
            <select
              id="credential-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
              disabled={saving || clearing}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="apify">Apify</option>
              <option value="treg">treg</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="credential-token"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {PROVIDER_LABELS[provider]} Token
            </label>
            <input
              id="credential-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={saving || clearing}
              placeholder={configured ? 'Enter a new token to replace the saved one' : 'Paste your token'}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Write-only: the token is encrypted before storage and is never returned by the API.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || clearing || !token.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : configured ? 'Replace Credential' : 'Save Credential'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!configured || saving || clearing}
              className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearing ? 'Clearing…' : 'Clear Credential'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-lg border border-green-100 dark:border-green-800">
            {notice}
          </div>
        )}
        {warning && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm rounded-lg border border-amber-100 dark:border-amber-800">
            {warning}
          </div>
        )}
      </section>

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <ShieldCheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Apify
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Apify requires a paid plan to run actors through the API. A free-plan token can be
            saved but scrapes will fail until the plan is upgraded.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <ShieldCheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            treg
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            treg Profile scrapes never return phone numbers. Email is optional and often missing
            from results. The token is validated by the first scrape.
          </p>
        </div>
      </section>
    </main>
  );
}
