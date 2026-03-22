// src/useAuth.js
import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in, object = logged in

  useEffect(() => {
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
      // Redirect back to current origin + path (without query params that could confuse OAuth)
      options: { redirectTo: window.location.origin + window.location.pathname },
    });

  const signOut = () => supabase.auth.signOut();

  return { user, signInWithGoogle, signOut };
}
