import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from '../../store/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Lazy import to avoid initialization timing issues
    const initAuth = async () => {
      try {
        const { auth } = await import('../../config/firebase');
        console.log('Auth object:', auth);
        const unsub = onAuthStateChanged(auth, (user) => {
          setUser(user);
          setLoading(false);
        });
        return unsub;
      } catch (e) {
        console.error('Auth init error:', e);
        setLoading(false);
      }
    };

    let unsubscribe: any;
    initAuth().then(unsub => { unsubscribe = unsub; });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  return <>{children}</>;
}