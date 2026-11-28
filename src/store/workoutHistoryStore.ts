import {
  create,
} from 'zustand';

import {
  auth,
} from '../config/firebase';

import {
  getWorkoutHistory,
  saveWorkoutSession,
} from '../services/workoutHistoryService';

import {
  getWorkoutSyncInfo,
  queueSessionForSync,
  syncWorkoutHistory,
  type WorkoutSyncResult,
} from '../services/workoutCloudSyncService';

import type {
  WorkoutSession,
} from '../types/history';

import type {
  ActiveWorkout,
} from '../types/workout';

interface WorkoutHistoryState {
  ownerUid:
    string | null;

  sessions:
    WorkoutSession[];

  isLoading:
    boolean;

  hasLoaded:
    boolean;

  error:
    string | null;

  /*
   * Cloud backup status, for showing
   * "Synced" / "3 waiting" in the UI.
   */
  syncStatus:
    | 'idle'
    | 'syncing'
    | 'synced'
    | 'offline'
    | 'error';

  pendingSyncCount:
    number;

  lastSyncedAt:
    number | null;

  syncNow:
    (options?: {
      force?: boolean;

      /*
       * Re-read the whole cloud backup,
       * not only recent changes.
       */
      full?: boolean;
    }) => Promise<WorkoutSyncResult | null>;

  loadHistory:
    () => Promise<void>;

  saveFinishedWorkout:
    (
      workout:
        ActiveWorkout
    ) => Promise<WorkoutSession>;

  getLatestForProgram:
    (
      programId:
        string
    ) =>
      WorkoutSession |
      undefined;

  resetHistoryState:
    () => void;
}

function getCurrentUid() {
  return (
    auth.currentUser
      ?.uid ??
    null
  );
}

const SYNC_THROTTLE_MS = 60 * 1000;

let lastSyncAttempt: {
  uid: string | null;
  at: number;
} = {
  uid: null,
  at: 0,
};

export const useWorkoutHistoryStore =
  create<WorkoutHistoryState>(
    (
      set,
      get
    ) => ({
      ownerUid:
        null,

      sessions:
        [],

      isLoading:
        false,

      hasLoaded:
        false,

      error:
        null,

      syncStatus:
        'idle',

      pendingSyncCount:
        0,

      lastSyncedAt:
        null,

      /*
       * ===============================
       * CLOUD SYNC
       * ===============================
       *
       * Uploads workouts waiting on this
       * phone and restores any that exist
       * only in Firebase.
       *
       * Never throws, never blocks saving.
       */
      syncNow:
        async (options) => {
          const uid =
            getCurrentUid();

          if (!uid) {
            return null;
          }

          /*
           * Screens call loadHistory() every
           * time they gain focus. Without
           * this, each tab switch would cost
           * a Firestore read.
           */
          const now = Date.now();

          if (
            !options?.force &&
            lastSyncAttempt.uid === uid &&
            now - lastSyncAttempt.at <
              SYNC_THROTTLE_MS
          ) {
            return null;
          }

          lastSyncAttempt = {
            uid,
            at: now,
          };

          set({
            syncStatus:
              'syncing',
          });

          const result =
            await syncWorkoutHistory({
              full: options?.full,
            });

          if (
            getCurrentUid() !== uid
          ) {
            return result;
          }

          /*
           * Workouts were restored from
           * Firebase: show them.
           */
          if (result.restored > 0) {
            try {
              const sessions =
                await getWorkoutHistory();

              if (
                getCurrentUid() === uid &&
                get().ownerUid === uid
              ) {
                set({ sessions });
              }
            } catch (error) {
              console.error(
                'History reload after sync failed:',
                error
              );
            }
          }

          set({
            syncStatus:
              result.status === 'signed-out'
                ? 'idle'
                : result.status,

            pendingSyncCount:
              result.pending,

            lastSyncedAt:
              result.lastSyncedAt,
          });

          return result;
        },

      /*
       * ===============================
       * LOAD HISTORY
       * ===============================
       */
      loadHistory:
        async () => {
          const uid =
            getCurrentUid();

          /*
           * Signed out:
           * clear any previous account
           * history from memory.
           */
          if (!uid) {
            set({
              ownerUid:
                null,

              sessions:
                [],

              isLoading:
                false,

              hasLoaded:
                false,

              error:
                null,
            });

            return;
          }

          /*
           * Account changed:
           * immediately remove the old
           * user's cached history.
           */
          if (
            get().ownerUid !==
            uid
          ) {
            set({
              ownerUid:
                uid,

              sessions:
                [],

              isLoading:
                true,

              hasLoaded:
                false,

              error:
                null,
            });
          } else {
            set({
              isLoading:
                true,

              error:
                null,
            });
          }

          try {
            const sessions =
              await getWorkoutHistory();

            /*
             * Protect against account
             * switching while storage
             * was loading.
             */
            if (
              getCurrentUid() !==
                uid
            ) {
              return;
            }

            if (
              get().ownerUid !==
              uid
            ) {
              return;
            }

            set({
              ownerUid:
                uid,

              sessions,

              isLoading:
                false,

              hasLoaded:
                true,

              error:
                null,
            });

            /*
             * Local data is on screen.
             * Back up / restore in the
             * background.
             */
            void get().syncNow();
          } catch (error) {
            console.error(
              'Workout history load error:',
              error
            );

            if (
              getCurrentUid() !==
              uid
            ) {
              return;
            }

            set({
              sessions:
                [],

              isLoading:
                false,

              hasLoaded:
                true,

              error:
                'Unable to load workout history.',
            });
          }
        },

      /*
       * ===============================
       * SAVE FINISHED WORKOUT
       * ===============================
       *
       * IMPORTANT:
       * This function ALWAYS returns the
       * WorkoutSession after successful
       * persistence.
       */
      saveFinishedWorkout:
        async (
          workout
        ) => {
          const uid =
            getCurrentUid();

          if (!uid) {
            throw new Error(
              'You must be signed in to save a workout.'
            );
          }

          if (
            workout.status !==
              'finished'
          ) {
            throw new Error(
              'Workout must be finished before saving.'
            );
          }

          if (
            !workout.finishedAt
          ) {
            throw new Error(
              'Finished workout is missing finishedAt.'
            );
          }

          /*
           * Make sure the in-memory
           * history belongs to the
           * current Firebase account.
           */
          if (
            get().ownerUid !==
            uid
          ) {
            await get()
              .loadHistory();
          }

          const finishedAt =
            workout.finishedAt;

          const durationSeconds =
            Math.max(
              0,
              Math.floor(
                (
                  finishedAt -
                  workout.startedAt
                ) / 1000
              )
            );

          const session:
            WorkoutSession = {
            id:
              workout.id,

            programId:
              workout.programId,

            programName:
              workout.programName,

            category:
              workout.category,

            startedAt:
              workout.startedAt,

            finishedAt,

            durationSeconds,

            completedSets:
              workout.completedSets,
          };

          /*
           * Persist first.
           */
          await saveWorkoutSession(
            session
          );

          /*
           * Mark it for Firebase upload.
           *
           * The mark is stored on the phone,
           * so an offline workout uploads
           * later, even after a restart.
           * A failure here must never fail
           * the local save.
           */
          try {
            await queueSessionForSync(
              uid,
              session.id
            );

            const info =
              await getWorkoutSyncInfo(
                uid
              );

            set({
              pendingSyncCount:
                info.pending,
            });
          } catch (error) {
            console.error(
              'Workout sync queue error:',
              error
            );
          }

          void get().syncNow({
            force: true,
          });

          /*
           * If the account changed during
           * the save, don't put this
           * session into the new user's
           * store.
           *
           * We still return the saved
           * session to the caller.
           */
          if (
            getCurrentUid() !==
            uid
          ) {
            return session;
          }

          const existing =
            get().sessions.filter(
              (item) =>
                item.id !==
                session.id
            );

          const sessions = [
            session,
            ...existing,
          ].sort(
            (
              a,
              b
            ) =>
              b.finishedAt -
              a.finishedAt
          );

          set({
            ownerUid:
              uid,

            sessions,

            isLoading:
              false,

            hasLoaded:
              true,

            error:
              null,
          });

          /*
           * THIS RETURN IS CRITICAL.
           *
           * DuringWorkoutScreen uses:
           *
           * savedSession.id
           *
           * for AfterWorkout navigation.
           */
          return session;
        },

      /*
       * ===============================
       * LATEST SAME PROGRAM
       * ===============================
       */
      getLatestForProgram:
        (
          programId
        ) => {
          const uid =
            getCurrentUid();

          if (!uid) {
            return undefined;
          }

          if (
            get().ownerUid !==
            uid
          ) {
            return undefined;
          }

          return get()
            .sessions.find(
              (session) =>
                session.programId ===
                programId
            );
        },

      /*
       * ===============================
       * RESET
       * ===============================
       */
      resetHistoryState:
        () => {
          set({
            syncStatus:
              'idle',

            pendingSyncCount:
              0,

            lastSyncedAt:
              null,

            ownerUid:
              null,

            sessions:
              [],

            isLoading:
              false,

            hasLoaded:
              false,

            error:
              null,
          });
        },
    })
  );