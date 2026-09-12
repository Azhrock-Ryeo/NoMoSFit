import React, {
  PropsWithChildren,
  useEffect,
} from 'react';

import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const setUser = useAuthStore(
    (state) => state.setUser
  );

  const setLoading = useAuthStore(
    (state) => state.setLoading
  );

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setLoading(false);
      },
      (error) => {
        console.error(
          'Firebase auth state error:',
          error
        );

        setUser(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [setLoading, setUser]);

  return <>{children}</>;
}