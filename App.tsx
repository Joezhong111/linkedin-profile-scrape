import React, { useEffect, useMemo, useState } from "react";
import Home from "./pages/Home";
import Profiles from "./pages/Profiles";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import { isSupabaseReady } from "./services/supabase";
import { supabaseBrowser } from "./lib/supabase-client";
import Navbar from "./components/Navbar";
import { getMe } from "./services/admin";

export default function App() {
  const [hash, setHash] = useState<string>(window.location.hash || "#/");
  const [apifyReady, setApifyReady] = useState<boolean>(
    Boolean(import.meta.env.VITE_APIFY_TOKEN)
  );
  const [authed, setAuthed] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const signOut = async () => {
    try {
      await supabaseBrowser.auth.signOut();
    } catch {}
    window.location.hash = "#/login";
  };

  // Probe server-side readiness (works in Vite dev via middleware and in Netlify via function)
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          if (typeof data?.apify === "boolean") setApifyReady(data.apify);
        }
      } catch (_) {
        // ignore: fall back to VITE_ value
      }
    };
    check();
  }, []);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Auth state gate: only logged-in users can access app routes
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      setAuthed(Boolean(data?.session?.user?.id));
      setAuthChecked(true);
    })();
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange(
      (_e, session) => {
        setAuthed(Boolean(session?.user?.id));
        setAuthChecked(true);
      }
    );
    return () => {
      sub.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!authChecked) return; // wait until we know auth state
    const h = (hash || "#/").toLowerCase();
    const wantsPublic = h.startsWith("#/login");
    if (!authed && !wantsPublic) {
      if (!h.startsWith("#/login")) window.location.hash = "#/login";
    }
    if (authed && wantsPublic) {
      window.location.hash = "#/dashboard";
    }
  }, [hash, authed, authChecked]);

  const route = useMemo(() => {
    const h = (hash || "#/").toLowerCase();
    if (h.startsWith("#/profiles")) return "profiles";
    if (h.startsWith("#/login")) return "login";
    if (h.startsWith("#/admin")) return "admin";
    // default and explicit dashboard both go to dashboard
    if (h.startsWith("#/dashboard") || h === "#/") return "dashboard";
    return "dashboard";
  }, [hash]);

  // Fetch admin flag when authenticated
  useEffect(() => {
    (async () => {
      if (!authed) {
        setIsAdmin(false);
        return;
      }
      try {
        const me = await getMe();
        setIsAdmin(Boolean(me?.isAdmin));
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [authed]);

  return (
    <div className="min-h-screen pb-12 bg-gray-50">
      <Navbar
        authed={authed}
        isAdmin={isAdmin}
        route={route}
        apifyReady={apifyReady}
        supabaseConnected={isSupabaseReady}
        onSignOut={signOut}
      />

      {route === "login" && <Login />}
      {route === "profiles" && <Profiles />}
      {route === "admin" && (isAdmin ? <Admin /> : <Home />)}
      {(route === "dashboard" || route === "home") && <Home />}
    </div>
  );
}
