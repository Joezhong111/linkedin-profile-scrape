import React from "react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type Props = {
  authed: boolean;
  route: string;
  apifyReady: boolean;
  supabaseConnected: boolean;
  onSignOut: () => void;
};

const Navbar: React.FC<Props> = ({ authed, route, apifyReady, supabaseConnected, onSignOut }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="#/" className="text-xl font-bold text-gray-900 tracking-tight">
            LinkedIn Insights Pro
          </a>
          {authed && (
            <nav className="hidden sm:flex items-center gap-3 text-sm">
              <a
                href="#/dashboard"
                className={`px-2 py-1 rounded-md ${
                  route === "dashboard" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Dashboard
              </a>
              <a
                href="#/profiles"
                className={`px-2 py-1 rounded-md ${
                  route === "profiles" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Profiles
              </a>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          {authed ? (
            <>
              <button
                onClick={onSignOut}
                className="px-2 py-1 rounded-md text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
              >
                Logout
              </button>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-gray-500">Apify:</span>
                {apifyReady ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4" /> Ready
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" /> Missing
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-gray-500">Supabase:</span>
                {supabaseConnected ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4" /> Connected
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" /> Disconnected
                  </span>
                )}
              </div>
            </>
          ) : (
            <a
              href="#/login"
              className="px-2 py-1 rounded-md text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
            >
              Login
            </a>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;

