import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { startSyncListener, syncPendingSessions } from '../../services/SyncService';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    // Sync immediately on mount
    syncPendingSessions(user.uid);

    // Also sync whenever connectivity changes
    const unsubscribe = startSyncListener(user.uid);

    return () => {
      unsubscribe();
    };
  }, [user]);

  return <>{children}</>;
}