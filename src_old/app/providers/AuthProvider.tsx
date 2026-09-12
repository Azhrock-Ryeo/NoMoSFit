import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from '../../store/authStore';
import { auth } from '../../config/firebase';

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setLoading(false);
      },
      (error) => {
        console.error('Auth state error:', error);
        setUser(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [setUser, setLoading]);

  return <>{children}</>;
}