import { useEffect, useState } from 'react';
import {
  getMe,
  getToggles,
  setToggles,
  adminCreateUser,
  type AdminRole,
} from '../services/admin';
import UserManager from '../components/UserManager';

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ user_id?: string; role?: string; isAdmin?: boolean } | null>(null);

  // system settings
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [savingToggles, setSavingToggles] = useState(false);

  // create user
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('user');
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [meRes, toggles] = await Promise.all([getMe(), getToggles()]);
        setMe(meRes);
        setRegistrationOpen(Boolean(toggles?.registration_open));
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveToggles = async () => {
    try {
      setSavingToggles(true);
      await setToggles({ registration_open: registrationOpen });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingToggles(false);
    }
  };

  const createUser = async () => {
    try {
      setCreating(true);
      if (!email) {
        alert('Email 必填');
        return;
      }
      if (!password) {
        alert('初始密码必填');
        return;
      }
      const res = await adminCreateUser({ email, password, role });
      alert('创建成功: ' + res.email);
      setEmail('');
      setPassword('');
      setRole('user');
      setRefreshKey((key) => key + 1);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  if (loading)
    return (
      <main className="max-w-5xl mx-auto px-4 mt-8 text-gray-900 dark:text-white">
        Loading admin...
      </main>
    );
  if (!me?.isAdmin)
    return (
      <main className="max-w-5xl mx-auto px-4 mt-8 text-gray-900 dark:text-white">Forbidden</main>
    );

  return (
    <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6 pb-12">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 rounded">
          {error}
        </div>
      )}

      <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Settings</h2>
        <div className="mt-4 flex items-center gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={registrationOpen}
              onChange={(e) => setRegistrationOpen(e.target.checked)}
              className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600"
            />
            <span>Registration Open</span>
          </label>
          <button
            onClick={saveToggles}
            disabled={savingToggles}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Save
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create User</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="initial password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="mt-3">
          <button
            onClick={createUser}
            disabled={creating}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Create
          </button>
        </div>
      </section>

      <UserManager refreshKey={refreshKey} />
    </main>
  );
}
