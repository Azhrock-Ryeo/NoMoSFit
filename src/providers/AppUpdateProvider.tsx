/*
 * Over-the-air updates.
 *
 * When you publish with "eas update", installed copies of the app
 * download the new version by themselves the next time they are
 * opened with a connection. This component makes that visible:
 *
 *   - checks on launch and whenever the app returns to the foreground
 *   - downloads a new version in the background
 *   - then offers "Restart now" so it takes effect immediately
 *
 * It never interrupts a workout: the offer waits until the workout
 * is finished. Choosing "Later" is fine too; a downloaded update is
 * used automatically the next time the app is fully closed and opened.
 *
 * Does nothing in the development app, where code comes from Metro.
 *
 * Renders nothing. Mount once.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useWorkoutStore } from '../store/workoutStore';
import { AppAlert } from '../redesign/feedback';

const CHECK_EVERY_MS = 10 * 60 * 1000;

type UpdatesModule = typeof import('expo-updates');

/*
 * Loaded this way so that an app build made before expo-updates
 * was added keeps working instead of failing at startup.
 */
export function loadUpdates(): UpdatesModule | null {
  try {
    return require('expo-updates') as UpdatesModule;
  } catch {
    return null;
  }
}

export function AppUpdateProvider() {
  useEffect(() => {
    const Updates = loadUpdates();

    if (__DEV__ || !Updates || !Updates.isEnabled) {
      return;
    }

    let checking = false;
    let ready = false;
    let offered = false;
    let lastCheck = 0;

    const offer = () => {
      if (!ready || offered) {
        return;
      }

      /* Mid-workout state lives in memory; a restart would lose it. */
      if (useWorkoutStore.getState().workout) {
        return;
      }

      offered = true;

      AppAlert.alert(
        'Update ready',
        'A new version of NoMoSFit has been downloaded. Restart now to use it?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart now',
            onPress: () => {
              Updates.reloadAsync().catch(() => undefined);
            },
          },
        ]
      );
    };

    const check = async () => {
      if (ready) {
        offer();
        return;
      }

      if (checking || Date.now() - lastCheck < CHECK_EVERY_MS) {
        return;
      }

      checking = true;
      lastCheck = Date.now();

      try {
        const found = await Updates.checkForUpdateAsync();

        if (found.isAvailable) {
          const fetched = await Updates.fetchUpdateAsync();

          if (fetched.isNew) {
            ready = true;
            offer();
          }
        }
      } catch {
        /* Offline or server unreachable: try again next time. */
      } finally {
        checking = false;
      }
    };

    void check();

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void check();
      }
    });

    /* A workout just ended: now is a good moment to offer. */
    const stopWorkout = useWorkoutStore.subscribe((state, previous) => {
      if (!state.workout && previous.workout) {
        offer();
      }
    });

    return () => {
      appState.remove();
      stopWorkout();
    };
  }, []);

  return null;
}
