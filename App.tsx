import React, { useEffect, useMemo, useState } from "react";
import Home from "./pages/Home";
import Profiles from "./pages/Profiles";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { isSupabaseReady } from "./services/supabase";

export default function App() {
  const [hash, setHash] = useState<string>(window.location.hash || "#/");
  const apifyReady = Boolean(import.meta.env.VITE_APIFY_TOKEN);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const route = useMemo(() => {
    const h = (hash || "#/").toLowerCase();
    if (h.startsWith("#/profiles")) return "profiles";
    return "home";
  }, [hash]);

  return (
    <div className="min-h-screen pb-12 bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="#/" className="text-xl font-bold text-gray-900 tracking-tight">LinkedIn Insights Pro</a>
            <nav className="hidden sm:flex items-center gap-3 text-sm">
              <a href="#/" className={`px-2 py-1 rounded-md ${route === "home" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900"}`}>Home</a>
              <a href="#/profiles" className={`px-2 py-1 rounded-md ${route === "profiles" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900"}`}>Profiles</a>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Apify:</span>
              {apifyReady ? (
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

      {route === "home" ? <Home/> : <Profiles/>}
    </div>
  );
}

