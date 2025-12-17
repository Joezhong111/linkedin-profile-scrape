import { createClient } from "@supabase/supabase-js";

// Front-end Supabase client for Auth only (public anon key)
// Prefer Vite-style vars; fallback to Next-style if provided
const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Soft warning in dev to help diagnose env issues
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      "Supabase env missing. Ensure VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_* are set."
    );
  }
}

export const supabaseBrowser = createClient(
  supabaseUrl || "",
  supabaseAnonKey || "",
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      autoRefreshToken: true,
    },
  }
);
