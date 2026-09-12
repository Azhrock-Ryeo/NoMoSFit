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