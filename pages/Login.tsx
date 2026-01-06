import React, { useState } from "react";
import { authClient } from "../lib/auth";
import { getToggles } from "../services/admin";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggles, setToggles] = useState({
    registration_open: true,
    google_oauth_open: true,
  });

  // If already authed, bounce to dashboard; also fetch toggles
  React.useEffect(() => {
    (async () => {
      const session = authClient.getSession();
      if (session?.user?.id) {
        // App.tsx will handle redirect based on auth state
        return;
      }
      try {
        const t = await getToggles();
        setToggles(t);
        if (!t.registration_open) setMode("signin");
      } catch { }
    })();

    const unsubscribe = authClient.onAuthStateChange((_user) => {
      // App.tsx handles route redirects based on auth state
    });

    return unsubscribe;
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signin") {
        await authClient.signIn(email, password);
        // App.tsx will handle redirect to dashboard based on auth state
      } else {
        await authClient.signUp(email, password);
        // App.tsx will handle redirect to dashboard based on auth state
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 mt-12">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {mode === "signin" ? "Sign in" : "Sign up"}
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mt-2">
          Use email/password or Google to continue.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600 dark:text-slate-400">
          {mode === "signin" ? (
            toggles.registration_open && (
              <button className="underline hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setMode("signup")}>
                Need an account? Sign up
              </button>
            )
          ) : (
            <button className="underline hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setMode("signin")}>
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
