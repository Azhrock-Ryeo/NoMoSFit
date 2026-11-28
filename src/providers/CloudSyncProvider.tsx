/*
 * Runs cloud sync automatically, for workout History and for
 * routines + training settings:
 *
 *   - when the user signs in
 *   - when the phone comes back online
 *   - when the app returns to the foreground
 *   - shortly after a routine or its settings are saved or removed
 *
 * (A finished workout is uploaded by the History store itself.)
 *
 * Renders nothing. Mount once, inside <AuthProvider>.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuthStore } from '../store/authStore';
import { useProgramStore } from '../store/programStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { useProgramSettings } from '../redesign/preferences';
import {
  isApplyingRemoteRoutines,
  syncRoutinesAndReload,
} from '../redesign/programSync';

const ROUTINE_EDIT_DELAY_MS = 1500;

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

      syncRoutinesAndReload({ force }).catch(() => undefined);
    };

    sync(true);

    /*
     * Saving a routine writes the routine and then its settings.
     * Wait a moment so both go up in one sync.
     */
    let timer: ReturnType<typeof setTimeout> | null = null;

    const routineEdited = () => {
      if (isApplyingRemoteRoutines()) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = null;
        syncRoutinesAndReload({ force: true }).catch(() => undefined);
      }, ROUTINE_EDIT_DELAY_MS);
    };

    const stopPrograms = useProgramStore.subscribe((state, previous) => {
      if (
        state.ownerUid === uid &&
        state.hasLoaded &&
        previous.hasLoaded &&
        state.programs !== previous.programs
      ) {
        routineEdited();
      }
    });

    const stopSettings = useProgramSettings.subscribe((state, previous) => {
      if (
        state.ownerUid === uid &&
        state.loaded &&
        previous.loaded &&
        state.values !== previous.values
      ) {
        routineEdited();
      }
    });

    let wasConnected: boolean | null = null;

    const stopNetwork = NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true;

      /* Only react to offline -> online. */
      if (connected && wasConnected === false) {
        sync(true);
      }

      wasConnected = connected;
    });

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        sync(false);
      }
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }

      stopPrograms();
      stopSettings();
      stopNetwork();
      appState.remove();
    };
  }, [uid]);

  return null;
}
