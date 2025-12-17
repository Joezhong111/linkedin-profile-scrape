import React from "react";
import { supabaseBrowser } from "../lib/supabase-client";

type Props = {
  className?: string;
  redirectTo?: string; // e.g. "#/dashboard"
};

export default function GoogleSignInButton({
  className,
  redirectTo = "#/dashboard",
}: Props) {
  const onClick = async () => {
    try {
      const { origin } = window.location;
      // Redirect directly to dashboard (hash route) after successful sign-in
      const finalRedirect = `${origin}/#/dashboard`;

      // Let supabase-js handle the redirect directly (more reliable)
      const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: finalRedirect,
          skipBrowserRedirect: false,
          // Force account chooser for clarity
          queryParams: { prompt: "select_account" },
          // flowType: "pkce", // optional: explicitly use PKCE
        },
      });

      // In some environments supabase still returns a URL; we fallback to manual navigation
      if (!error && data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      console.error("Google OAuth error:", err);
      alert(
        "Google 登录启动失败，请检查 Supabase URL 配置（Site URL/Additional Redirect URLs）并重试。"
      );
    }
  };

  return (
    <button
      onClick={onClick}
      className={
        className ||
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-black text-white hover:bg-gray-800 text-sm"
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="h-4 w-4"
      >
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303C33.657 32.332 29.185 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.993 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.818C14.431 16.087 18.879 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.993 4 24 4c-7.732 0-14.356 4.386-17.694 10.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.123 0 9.77-1.953 13.292-5.146l-6.146-5.207C29.092 35.091 26.668 36 24 36c-5.167 0-9.617-3.644-11.303-8.553l-6.526 5.027C9.467 39.5 16.199 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.02 12.02 0 01-4.157 5.647l.003-.002 6.146 5.207C35.106 39.5 40 36 42 28c.666-2.666 1-5 1-7.917z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
