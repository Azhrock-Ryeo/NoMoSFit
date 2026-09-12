import {
  create,
} from 'zustand';

import {
  auth,
} from '../config/firebase';

import {
  clearWorkoutPrograms,
  createWorkoutProgram,
  deleteWorkoutProgram,
  getWorkoutPrograms,
  type NewWorkoutProgram,
  updateWorkoutProgram,
} from '../services/programService';

import type {
  WorkoutProgram,
} from '../types/program';

interface ProgramStore {
  /*
   * Firebase UID whose programs are
   * currently loaded in memory.
   */
  ownerUid:
    string | null;

  programs:
    WorkoutProgram[];

  isLoading:
    boolean;

  hasLoaded:
    boolean;

  error:
    string | null;

  loadPrograms:
    () => Promise<void>;

  refreshPrograms:
    () => Promise<void>;

  addProgram:
    (
      input:
        NewWorkoutProgram |
        WorkoutProgram
    ) => Promise<WorkoutProgram>;

  createProgram:
    (
      input:
        NewWorkoutProgram |
        WorkoutProgram
    ) => Promise<WorkoutProgram>;

  editProgram: {
    (
      id: string,
      updates:
        Partial<WorkoutProgram>
    ): Promise<WorkoutProgram>;

    (
      program:
        WorkoutProgram
    ): Promise<WorkoutProgram>;
  };

  updateProgram: {
    (
      id: string,
      updates:
        Partial<WorkoutProgram>
    ): Promise<WorkoutProgram>;

    (
      program:
        WorkoutProgram
    ): Promise<WorkoutProgram>;
  };

  removeProgram:
    (
      idOrProgram:
        string |
        WorkoutProgram
    ) => Promise<void>;

  deleteProgram:
    (
      idOrProgram:
        string |
        WorkoutProgram
    ) => Promise<void>;

  findProgram:
    (
      id: string
    ) =>
      WorkoutProgram |
      undefined;

  getProgramById:
    (
      id: string
    ) =>
      WorkoutProgram |
      undefined;

  clearPrograms:
    () => Promise<void>;

  resetProgramState:
    () => void;
}

function getCurrentUid() {
  return (
    auth.currentUser
      ?.uid ??
    null
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

export const useProgramStore =
  create<ProgramStore>(
    (
      set,
      get
    ) => {
      const performCreate =
        async (
          input:
            NewWorkoutProgram |
            WorkoutProgram
        ) => {
          const uid =
            getCurrentUid();

          if (!uid) {
            throw new Error(
              'You must be signed in to create a program.'
            );
          }

          /*
           * If another account's
           * programs are in memory,
           * load the correct account
           * first.
           */
          if (
            get().ownerUid !==
            uid
          ) {
            await get()
              .loadPrograms();
          }

          try {
            set({
              error:
                null,
            });

            const program =
              await createWorkoutProgram(
                input
              );

            /*
             * Account may have changed
             * during AsyncStorage work.
             */
            if (
              getCurrentUid() !==
              uid
            ) {
              return program;
            }

            const existing =
              get().programs.filter(
                (item) =>
                  item.id !==
                  program.id
              );

            const programs = [
              program,
              ...existing,
            ].sort(
              (
                a,
                b
              ) =>
                b.updatedAt -
                a.updatedAt
            );

            set({
              ownerUid:
                uid,

              programs,

              hasLoaded:
                true,

              error:
                null,
            });

            return program;
          } catch (error) {
            const message =
              getErrorMessage(
                error,
                'Unable to create program.'
              );

            set({
              error:
                message,
            });

            throw error;
          }
        };

      const performUpdate =
        async (
          idOrProgram:
            string |
            WorkoutProgram,
          updates:
            Partial<WorkoutProgram> =
              {}
        ) => {
          const uid =
            getCurrentUid();

          if (!uid) {
            throw new Error(
              'You must be signed in to edit a program.'
            );
          }

          if (
            get().ownerUid !==
            uid
          ) {
            await get()
              .loadPrograms();
          }

          try {
            set({
              error:
                null,
            });

            const updatedProgram =
              await updateWorkoutProgram(
                idOrProgram,
                updates
              );

            if (
              getCurrentUid() !==
              uid
            ) {
              return updatedProgram;
            }

            const programs =
              get()
                .programs
                .map(
                  (program) =>
                    program.id ===
                    updatedProgram.id
                      ? updatedProgram
                      : program
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    b.updatedAt -
                    a.updatedAt
                );

            set({
              ownerUid:
                uid,

              programs,

              hasLoaded:
                true,

              error:
                null,
            });

            return updatedProgram;
          } catch (error) {
            set({
              error:
                getErrorMessage(
                  error,
                  'Unable to update program.'
                ),
            });

            throw error;
          }
        };

      const performDelete =
        async (
          idOrProgram:
            string |
            WorkoutProgram
        ) => {
          const uid =
            getCurrentUid();

          if (!uid) {
            throw new Error(
              'You must be signed in to delete a program.'
            );
          }

          if (
            get().ownerUid !==
            uid
          ) {
            await get()
              .loadPrograms();
          }

          const id =
            typeof idOrProgram ===
            'string'
              ? idOrProgram
              : idOrProgram.id;

          try {
            set({
              error:
                null,
            });

            await deleteWorkoutProgram(
              id
            );

            if (
              getCurrentUid() !==
              uid
            ) {
              return;
            }

            set({
              programs:
                get().programs.filter(
                  (program) =>
                    program.id !==
                    id
                ),

              ownerUid:
                uid,

              hasLoaded:
                true,

              error:
                null,
            });
          } catch (error) {
            set({
              error:
                getErrorMessage(
                  error,
                  'Unable to delete program.'
                ),
            });

            throw error;
          }
        };

      return {
        ownerUid:
          null,

        programs:
          [],

        isLoading:
          false,

        hasLoaded:
          false,

        error:
          null,

        /*
         * =============================
         * LOAD
         * =============================
         */
        loadPrograms:
          async () => {
            const uid =
              getCurrentUid();

            /*
             * Signed out:
             * remove previous account's
             * programs from memory.
             */
            if (!uid) {
              set({
                ownerUid:
                  null,

                programs:
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
             * Account switch:
             * immediately wipe old
             * account's cached programs.
             */
            if (
              get().ownerUid !==
              uid
            ) {
              set({
                ownerUid:
                  uid,

                programs:
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
              const programs =
                await getWorkoutPrograms();

              /*
               * Do not inject Account A
               * data if the user switched
               * to Account B while the
               * storage read was running.
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

                programs,

                isLoading:
                  false,

                hasLoaded:
                  true,

                error:
                  null,
              });
            } catch (error) {
              console.error(
                'Program load error:',
                error
              );

              if (
                getCurrentUid() !==
                uid
              ) {
                return;
              }

              set({
                programs:
                  [],

                isLoading:
                  false,

                hasLoaded:
                  true,

                error:
                  getErrorMessage(
                    error,
                    'Unable to load programs.'
                  ),
              });
            }
          },

        refreshPrograms:
          async () => {
            await get()
              .loadPrograms();
          },

        /*
         * =============================
         * CREATE
         * =============================
         */
        addProgram:
          performCreate,

        createProgram:
          performCreate,

        /*
         * =============================
         * UPDATE
         * =============================
         */
        editProgram:
          performUpdate,

        updateProgram:
          performUpdate,

        /*
         * =============================
         * DELETE
         * =============================
         */
        removeProgram:
          performDelete,

        deleteProgram:
          performDelete,

        /*
         * =============================
         * FIND
         * =============================
         */
        findProgram:
          (
            id
          ) => {
            const uid =
              getCurrentUid();

            if (
              !uid ||
              get().ownerUid !==
                uid
            ) {
              return undefined;
            }

            return get()
              .programs.find(
                (program) =>
                  program.id ===
                  id
              );
          },

        getProgramById:
          (
            id
          ) => {
            const uid =
              getCurrentUid();

            if (
              !uid ||
              get().ownerUid !==
                uid
            ) {
              return undefined;
            }

            return get()
              .programs.find(
                (program) =>
                  program.id ===
                  id
              );
          },

        /*
         * =============================
         * CLEAR CURRENT USER
         * =============================
         */
        clearPrograms:
          async () => {
            const uid =
              getCurrentUid();

            if (!uid) {
              set({
                ownerUid:
                  null,

                programs:
                  [],

                hasLoaded:
                  false,
              });

              return;
            }

            await clearWorkoutPrograms();

            set({
              ownerUid:
                uid,

              programs:
                [],

              isLoading:
                false,

              hasLoaded:
                true,

              error:
                null,
            });
          },

        /*
         * =============================
         * MEMORY RESET
         * =============================
         */
        resetProgramState:
          () => {
            set({
              ownerUid:
                null,

              programs:
                [],

              isLoading:
                false,

              hasLoaded:
                false,

              error:
                null,
            });
          },
      };
    }
  );