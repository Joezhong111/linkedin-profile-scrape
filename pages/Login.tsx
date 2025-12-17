import React from "react";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  return (
    <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 mt-12">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
        <p className="text-gray-600 mt-2">Use your Google account to continue.</p>
        <div className="mt-6">
          <GoogleSignInButton className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-black text-white hover:bg-gray-800" redirectTo="#/dashboard"/>
        </div>
      </div>
    </main>
  );
}

