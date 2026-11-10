import React, { Suspense, useEffect, useMemo, useState } from 'react';
const Home = React.lazy(() => import('./pages/Home'));
const Profiles = React.lazy(() => import('./pages/Profiles'));
const Leads = React.lazy(() => import('./pages/Leads'));
const Login = React.lazy(() => import('./pages/Login'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Settings = React.lazy(() => import('./pages/Settings'));
import { authClient } from './lib/auth';
import Navbar from './components/Navbar';
import { getMe } from './services/admin';
import {
  CREDENTIALS_CHANGED_EVENT,
  getCredentialStatus,
  type ProviderId,
} from './services/account';
import { ThemeProvider } from './lib/ThemeContext';
import { ToastProvider } from './lib/ToastContext';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState<string>(window.location.hash || '#/');
  const [credentialProvider, setCredentialProvider] = useState<ProviderId | null>(null);
  const [credentialReady, setCredentialReady] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const redirectingRef = React.useRef(false);

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Signing out locally still succeeds if the server call fails.
    }
    window.location.hash = '#/login';
  };

  // Credential status drives the provider indicator and scrape gating. Refresh
  // whenever Settings saves or clears a credential.
  useEffect(() => {
    let cancelled = false;
    if (!authed) {
      setCredentialProvider(null);
      setCredentialReady(false);
      return;
    }

    const refresh = async () => {
      try {
        const status = await getCredentialStatus();
        if (cancelled) return;
        setCredentialProvider(status.provider);
        setCredentialReady(status.configured);
      } catch {
        if (cancelled) return;
        setCredentialProvider(null);
        setCredentialReady(false);
      }
    };

    refresh();
    window.addEventListener(CREDENTIALS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(CREDENTIALS_CHANGED_EVENT, refresh);
    };
  }, [authed]);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Auth state gate: only logged-in users can access app routes
  useEffect(() => {
    const session = authClient.getSession();
    setAuthed(Boolean(session?.user?.id));
    setAuthChecked(true);

    const unsubscribe = authClient.onAuthStateChange((user) => {
      setAuthed(Boolean(user?.id));
      setAuthChecked(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authChecked) return; // wait until we know auth state
    const h = (hash || '#/').toLowerCase();
    const wantsPublic = h.startsWith('#/login');
    if (!authed && !wantsPublic) {
      if (h !== '#/login' && !redirectingRef.current) {
        redirectingRef.current = true;
        setTimeout(() => {
          window.location.hash = '#/login';
          redirectingRef.current = false;
        }, 0);
      }
    }
    if (authed && wantsPublic) {
      if (h !== '#/dashboard' && !redirectingRef.current) {
        redirectingRef.current = true;
        setTimeout(() => {
          window.location.hash = '#/dashboard';
          redirectingRef.current = false;
        }, 0);
      }
    }
  }, [hash, authed, authChecked]);

  const route = useMemo(() => {
    const h = (hash || '#/').toLowerCase();
    if (h.startsWith('#/profiles')) return 'profiles';
    if (h.startsWith('#/leads')) return 'leads';
    if (h.startsWith('#/login')) return 'login';
    if (h.startsWith('#/admin')) return 'admin';
    if (h.startsWith('#/settings')) return 'settings';
    // default and explicit dashboard both go to dashboard
    if (h.startsWith('#/dashboard') || h === '#/') return 'dashboard';
    return 'dashboard';
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
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <div className="min-h-screen pb-12 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 transition-colors">
            <Navbar
              authed={authed}
              isAdmin={isAdmin}
              route={route}
              provider={credentialProvider}
              credentialReady={credentialReady}
              onSignOut={signOut}
            />

            <Suspense fallback={<PageLoader />}>
              <PageTransition key={route}>
                {route === 'login' && <Login />}
                {route === 'profiles' && <Profiles />}
                {route === 'leads' && <Leads />}
                {route === 'admin' && (isAdmin ? <Admin /> : <Home />)}
                {route === 'settings' && <Settings />}
                {route === 'dashboard' && <Home />}
              </PageTransition>
            </Suspense>
          </div>
          <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
