// Authentication utilities for JWT-based auth
import { User, Session } from "../db/schema";

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

// Client-side auth state management
class AuthClient {
  private static TOKEN_KEY = "auth_token";
  private static USER_KEY = "auth_user";
  private static EVENT = "auth_state_changed";

  // Get current session from localStorage
  getSession(): AuthSession | null {
    try {
      const token = localStorage.getItem(AuthClient.TOKEN_KEY);
      const userStr = localStorage.getItem(AuthClient.USER_KEY);

      if (!token || !userStr) return null;

      const user = JSON.parse(userStr) as AuthUser;

      // Check if token is expired (basic check)
      // In production, you'd want to validate the JWT
      return { user, token, expiresAt: "" };
    } catch {
      return null;
    }
  }

  // Get current user
  getUser(): AuthUser | null {
    const session = this.getSession();
    return session?.user || null;
  }

  // Set session
  setSession(session: AuthSession): void {
    localStorage.setItem(AuthClient.TOKEN_KEY, session.token);
    localStorage.setItem(AuthClient.USER_KEY, JSON.stringify(session.user));
    // Notify listeners in this tab
    try {
      window.dispatchEvent(new Event(AuthClient.EVENT));
    } catch {}
  }

  // Clear session
  clearSession(): void {
    localStorage.removeItem(AuthClient.TOKEN_KEY);
    localStorage.removeItem(AuthClient.USER_KEY);
    // Notify listeners in this tab
    try {
      window.dispatchEvent(new Event(AuthClient.EVENT));
    } catch {}
  }

  // Sign in with email/password
  async signIn(email: string, password: string): Promise<AuthSession> {
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || "Sign in failed");
    }

    const session = await res.json();
    this.setSession(session);
    return session;
  }

  // Sign up with email/password
  async signUp(
    email: string,
    password: string,
    fullName?: string
  ): Promise<AuthSession> {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || "Sign up failed");
    }

    const session = await res.json();
    this.setSession(session);
    return session;
  }

  // Sign out
  async signOut(): Promise<void> {
    const token = localStorage.getItem(AuthClient.TOKEN_KEY);

    if (token) {
      try {
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore errors on signout
      }
    }

    this.clearSession();
  }

  // Get auth headers for API calls
  getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem(AuthClient.TOKEN_KEY);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    const handler = () => {
      const user = this.getUser();
      callback(user);
    };

    // Listen for storage events (for multi-tab sync)
    window.addEventListener("storage", handler);
    // Also listen for in-tab custom events fired by setSession/clearSession
    window.addEventListener(AuthClient.EVENT, handler as EventListener);

    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(AuthClient.EVENT, handler as EventListener);
    };
  }
}

export const authClient = new AuthClient();
