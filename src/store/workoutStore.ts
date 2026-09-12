import { create } from 'zustand';

import type {
  WorkoutProgram,
} from '../types/program';

import type {
  WorkoutSession,
} from '../types/history';

import type {
  ActiveWorkout,
  CompletedWorkoutSet,
} from '../types/workout';

function createId() {
  return [
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 10),
  ].join('-');
}

function normalizeWeight(
  value: number
) {
  return (
    Math.round(
      Math.max(0, value) * 2
    ) / 2
  );
}

function clampReps(
  value: number
) {
  return Math.max(
    1,
    Math.min(
      100,
      Math.round(value)
    )
  );
}

interface WorkoutState {
  workout: ActiveWorkout | null;

  startWorkout: (
    program: WorkoutProgram,
    previousSession?: WorkoutSession
  ) => void;

  setCurrentWeight: (
    weight: number
  ) => void;

  adjustCurrentWeight: (
    amount: number
  ) => void;

  beginRest: () => void;

  setRestReps: (
    reps: number
  ) => void;

  setRestWeight: (
    weight: number
  ) => void;

  adjustRestWeight: (
    amount: number
  ) => void;

  finishRest: () => void;

  resetWorkout: () => void;
}

export const useWorkoutStore =
  create<WorkoutState>(
    (set, get) => ({
      workout: null,

      startWorkout: (
        program,
        previousSession
      ) => {
        const workout: ActiveWorkout = {
          id: createId(),

          programId:
            program.id,

          programName:
            program.name,

          category:
            program.category,

          startedAt:
            Date.now(),

          finishedAt: null,

          status: 'active',

          currentExerciseIndex:
            0,

          currentSetIndex:
            0,

          exercises:
            program.exercises.map(
              (exercise) => {
                /**
                 * Use Set 1 from the
                 * most recent workout
                 * as the starting weight
                 * for this exercise.
                 */
                const previousSet =
                  previousSession?.completedSets.find(
                    (completedSet) =>
                      completedSet.exerciseId ===
                        exercise.id &&
                      completedSet.setNumber ===
                        1
                  );

                return {
                  id:
                    exercise.id,

                  name:
                    exercise.name,

                  totalSets:
                    exercise.sets,

                  targetReps:
                    exercise.targetReps,

                  workingWeight:
                    normalizeWeight(
                      previousSet?.weight ??
                        0
                    ),
                };
              }
            ),

          completedSets: [],

          rest: null,
        };

        set({
          workout,
        });
      },

      setCurrentWeight: (
        weight
      ) => {
        const workout =
          get().workout;

        if (
          !workout ||
          workout.status !==
            'active' ||
          workout.rest
        ) {
          return;
        }

        const exerciseIndex =
          workout.currentExerciseIndex;

        const exercises =
          workout.exercises.map(
            (
              exercise,
              index
            ) =>
              index ===
              exerciseIndex
                ? {
                    ...exercise,

                    workingWeight:
                      normalizeWeight(
                        weight
                      ),
                  }
                : exercise
          );

        set({
          workout: {
            ...workout,
            exercises,
          },
        });
      },

      adjustCurrentWeight: (
        amount
      ) => {
        const workout =
          get().workout;

        if (
          !workout ||
          workout.rest
        ) {
          return;
        }

        const exercise =
          workout.exercises[
            workout
              .currentExerciseIndex
          ];

        if (!exercise) {
          return;
        }

        get().setCurrentWeight(
          exercise.workingWeight +
            amount
        );
      },

      beginRest: () => {
        const workout =
          get().workout;

        if (
          !workout ||
          workout.status !==
            'active' ||
          workout.rest
        ) {
          return;
        }

        const exerciseIndex =
          workout.currentExerciseIndex;

        const setIndex =
          workout.currentSetIndex;

        const exercise =
          workout.exercises[
            exerciseIndex
          ];

        if (!exercise) {
          return;
        }

        const isLastSet =
          setIndex >=
          exercise.totalSets -
            1;

        const isLastExercise =
          exerciseIndex >=
          workout.exercises.length -
            1;

        let nextWeight =
          exercise.workingWeight;

        if (
          isLastSet &&
          !isLastExercise
        ) {
          nextWeight =
            workout.exercises[
              exerciseIndex + 1
            ]?.workingWeight ?? 0;
        }

        set({
          workout: {
            ...workout,

            rest: {
              exerciseIndex,
              setIndex,

              reps:
                exercise.targetReps,

              nextWeight,

              startedAt:
                Date.now(),

              durationSeconds:
                90,
            },
          },
        });
      },

      setRestReps: (
        reps
      ) => {
        const workout =
          get().workout;

        if (
          !workout?.rest
        ) {
          return;
        }

        set({
          workout: {
            ...workout,

            rest: {
              ...workout.rest,

              reps:
                clampReps(
                  reps
                ),
            },
          },
        });
      },

      setRestWeight: (
        weight
      ) => {
        const workout =
          get().workout;

        if (
          !workout?.rest
        ) {
          return;
        }

        set({
          workout: {
            ...workout,

            rest: {
              ...workout.rest,

              nextWeight:
                normalizeWeight(
                  weight
                ),
            },
          },
        });
      },

      adjustRestWeight: (
        amount
      ) => {
        const workout =
          get().workout;

        if (
          !workout?.rest
        ) {
          return;
        }

        get().setRestWeight(
          workout.rest.nextWeight +
            amount
        );
      },

      finishRest: () => {
        const workout =
          get().workout;

        if (
          !workout ||
          workout.status !==
            'active' ||
          !workout.rest
        ) {
          return;
        }

        const rest =
          workout.rest;

        const exerciseIndex =
          rest.exerciseIndex;

        const setIndex =
          rest.setIndex;

        const exercise =
          workout.exercises[
            exerciseIndex
          ];

        if (!exercise) {
          return;
        }

        const completedSet:
          CompletedWorkoutSet = {
          id: createId(),

          exerciseId:
            exercise.id,

          exerciseName:
            exercise.name,

          exerciseIndex,

          setNumber:
            setIndex + 1,

          targetReps:
            exercise.targetReps,

          reps:
            rest.reps,

          weight:
            exercise.workingWeight,

          completedAt:
            Date.now(),
        };

        const completedSets = [
          ...workout.completedSets,
          completedSet,
        ];

        const isLastSet =
          setIndex >=
          exercise.totalSets -
            1;

        const isLastExercise =
          exerciseIndex >=
          workout.exercises.length -
            1;

        if (
          isLastSet &&
          isLastExercise
        ) {
          set({
            workout: {
              ...workout,

              completedSets,

              rest: null,

              status:
                'finished',

              finishedAt:
                Date.now(),
            },
          });

          return;
        }

        if (!isLastSet) {
          const exercises =
            workout.exercises.map(
              (
                item,
                index
              ) =>
                index ===
                exerciseIndex
                  ? {
                      ...item,

                      workingWeight:
                        normalizeWeight(
                          rest.nextWeight
                        ),
                    }
                  : item
            );

          set({
            workout: {
              ...workout,

              exercises,

              completedSets,

              rest: null,

              currentSetIndex:
                setIndex + 1,
            },
          });

          return;
        }

        const nextExerciseIndex =
          exerciseIndex + 1;

        const exercises =
          workout.exercises.map(
            (
              item,
              index
            ) =>
              index ===
              nextExerciseIndex
                ? {
                    ...item,

                    workingWeight:
                      normalizeWeight(
                        rest.nextWeight
                      ),
                  }
                : item
          );

        set({
          workout: {
            ...workout,

            exercises,

            completedSets,

            rest: null,

            currentExerciseIndex:
              nextExerciseIndex,

            currentSetIndex:
              0,
          },
        });
      },

      resetWorkout: () => {
        set({
          workout: null,
        });
      },
    })
  );