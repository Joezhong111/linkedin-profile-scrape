import React, { useEffect, useState } from "react";
import { authClient } from "../lib/auth";

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const user = authClient.getUser();
    setUserId(user?.id || null);
    setEmail(user?.email || null);
  }, []);

  const signOut = async () => {
    await authClient.signOut();
    window.location.hash = "#/";
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {userId ? (
          <div className="mt-4 text-gray-700">
            <p>
              Signed in as <span className="font-mono">{email || userId}</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              user_id: <span className="font-mono">{userId}</span>
            </p>
            <button
              onClick={signOut}
              className="mt-4 inline-flex items-center px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-4 text-gray-700">
            <p>You are not signed in.</p>
            <a href="#/login" className="text-blue-600 hover:underline">
              Go to Login
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
