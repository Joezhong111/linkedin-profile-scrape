import React, { useEffect, useMemo, useState } from "react";
import { getMe, getQuota, getToggles, setQuota, setToggles, adminCreateUser } from "../services/admin";
import QuotaManager from "../components/QuotaManager";

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ user_id?: string; role?: string; isAdmin?: boolean } | null>(null);

  // toggles
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [googleOpen, setGoogleOpen] = useState(true);
  const [savingToggles, setSavingToggles] = useState(false);

  // create user
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(false);
  const [initLimit, setInitLimit] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [meRes, toggles] = await Promise.all([getMe(), getToggles()]);
        setMe(meRes);
        setRegistrationOpen(Boolean(toggles?.registration_open));
        setGoogleOpen(Boolean(toggles?.google_oauth_open));
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveToggles = async () => {
    try {
      setSavingToggles(true);
      await setToggles({ registration_open: registrationOpen, google_oauth_open: googleOpen });
    } catch (e: any) {
      alert(e?.message || "Save failed");
    } finally {
      setSavingToggles(false);
    }
  };

  const createUser = async () => {
    try {
      setCreating(true);
      if (!email) { alert("Email 必填"); return; }
      if (!invite && !password) { alert("未使用邀请时需设置初始密码"); return; }
      const monthly_limit = initLimit ? Number(initLimit) : undefined;
      const res = await adminCreateUser({ email, password: invite ? undefined : password, invite, monthly_limit });
      alert("创建成功: " + JSON.stringify(res));
      setEmail(""); setPassword(""); setInvite(false); setInitLimit("");
    } catch (e: any) {
      alert(e?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <main className="max-w-5xl mx-auto px-4 mt-8">Loading admin...</main>;
  if (!me?.isAdmin) return <main className="max-w-5xl mx-auto px-4 mt-8">Forbidden</main>;

  return (
    <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6 pb-12">
      {error && <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded">{error}</div>}

      <section className="bg-white border rounded-xl p-6">
        <h2 className="text-lg font-semibold">System Settings</h2>
        <div className="mt-4 flex items-center gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={registrationOpen} onChange={(e) => setRegistrationOpen(e.target.checked)} />
            <span>Registration Open</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={googleOpen} onChange={(e) => setGoogleOpen(e.target.checked)} />
            <span>Google OAuth Open</span>
          </label>
          <button onClick={saveToggles} disabled={savingToggles} className="px-3 py-1.5 rounded border text-sm">Save</button>
        </div>
      </section>

      <section className="bg-white border rounded-xl p-6">
        <h2 className="text-lg font-semibold">Create User</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="initial password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded px-3 py-2 text-sm" disabled={invite} />
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> send invite</label>
          <input placeholder="monthly limit (optional)" value={initLimit} onChange={(e) => setInitLimit(e.target.value)} className="border rounded px-3 py-2 text-sm" />
        </div>
        <div className="mt-3"><button onClick={createUser} disabled={creating} className="px-3 py-1.5 rounded border text-sm">Create</button></div>
      </section>

      <QuotaManager />
    </main>
  );
}
