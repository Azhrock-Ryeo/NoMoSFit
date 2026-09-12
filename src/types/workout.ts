import type {
  WorkoutCategory,
} from './program';

export type WorkoutStatus =
  | 'active'
  | 'finished';

export interface ActiveWorkoutExercise {
  id: string;

  name: string;

  totalSets: number;

  targetReps: number;

  /**
   * Weight that will be used
   * for the current set.
   */
  workingWeight: number;
}

export interface CompletedWorkoutSet {
  id: string;

  exerciseId: string;
  exerciseName: string;

  exerciseIndex: number;

  setNumber: number;

  targetReps: number;

  /**
   * Actual reps performed.
   */
  reps: number;

  /**
   * Actual weight used
   * for this completed set.
   */
  weight: number;

  completedAt: number;
}

export interface WorkoutRestState {
  /**
   * Set that was just performed.
   */
  exerciseIndex: number;
  setIndex: number;

  /**
   * Actual reps for that set.
   */
  reps: number;

  /**
   * Weight that should be used
   * on the next set/exercise.
   */
  nextWeight: number;

  startedAt: number;

  durationSeconds: number;
}

export interface ActiveWorkout {
  id: string;

  programId: string;
  programName: string;

  category: WorkoutCategory;

  startedAt: number;

  finishedAt: number | null;

  status: WorkoutStatus;

  exercises: ActiveWorkoutExercise[];

  currentExerciseIndex: number;
  currentSetIndex: number;

  completedSets: CompletedWorkoutSet[];

  /**
   * Null while performing a set.
   *
   * Contains rest information after
   * Complete Set is pressed.
   */
  rest: WorkoutRestState | null;
}