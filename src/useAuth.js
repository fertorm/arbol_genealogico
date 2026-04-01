// src/useAuth.js
import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const AUTH_RETURN_KEY = 'arbol-auth-return-to';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in, object = logged in

  useEffect(() => {
    try {
      const returnTo = localStorage.getItem(AUTH_RETURN_KEY);
      const currentPath = window.location.pathname + window.location.search;
      if (window.location.hash.includes('access_token')) {
        window.history.replaceState({}, '', currentPath);
      }
      if (returnTo && returnTo !== currentPath) {
        localStorage.removeItem(AUTH_RETURN_KEY);
        window.location.replace(returnTo);
        return;
      }
    } catch {}

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
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
