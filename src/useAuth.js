// src/useAuth.js
import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const AUTH_RETURN_KEY = 'arbol-auth-return-to';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in, object = logged in

  const syncUser = (nextUser) => {
    setUser(prev => {
      if (prev === undefined) return nextUser ?? null;
      if (!prev && !nextUser) return null;
      if (prev?.id && nextUser?.id && prev.id === nextUser.id) return prev;
      return nextUser ?? null;
    });
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isActive) return;
      syncUser(session?.user ?? null);

      try {
        const returnTo = localStorage.getItem(AUTH_RETURN_KEY);
        const currentPath = window.location.pathname + window.location.search;
        const hasAuthHash = window.location.hash.includes('access_token');

        if (session?.user && returnTo && returnTo !== currentPath) {
          localStorage.removeItem(AUTH_RETURN_KEY);
          window.location.replace(returnTo);
          return;
        }

        if (hasAuthHash) {
          window.history.replaceState({}, '', currentPath);
        }
      } catch {}
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ?? null);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: (() => {
        const returnTo = window.location.pathname + window.location.search;
        try { localStorage.setItem(AUTH_RETURN_KEY, returnTo); } catch {}
        return { redirectTo: window.location.origin + returnTo };
      })(),
    });

  const signOut = () => supabase.auth.signOut();

  return { user, signInWithGoogle, signOut };
}
