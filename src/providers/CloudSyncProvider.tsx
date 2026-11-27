/*
 * Runs workout cloud sync automatically:
 *
 *   - when the user signs in
 *   - when the phone comes back online
 *   - when the app returns to the foreground
 *
 * Renders nothing. Mount once, inside <AuthProvider>.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuthStore } from '../store/authStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';

export function CloudSyncProvider() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const sync = (force: boolean) => {
      useWorkoutHistoryStore
        .getState()
        .syncNow({ force })
        .catch(() => undefined);
    };

    sync(true);

    let wasConnected: boolean | null = null;

    const stopNetwork = NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true;

      /* Only react to offline -> online. */
      if (connected && wasConnected === false) {
        sync(true);
      }

      wasConnected = connected;
    });

    const appState = AppState.addEventListener(
      'change',
      (next) => {
        if (next === 'active') {
          sync(false);
        }
      }
    );

    return () => {
      stopNetwork();
      appState.remove();
    };
  }, [uid]);

  return null;
}
