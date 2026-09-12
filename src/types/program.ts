export type WorkoutCategory =
  | 'PUSH'
  | 'PULL'
  | 'CORE'
  | 'LEGS'
  | 'FULL BODY';

export interface ProgramExercise {
  id: string;

  /**
   * Exercise display name.
   * Example: "Bench Press"
   */
  name: string;

  /**
   * Number of working sets.
   */
  sets: number;

  /**
   * Goal reps for each set.
   *
   * Example:
   * 8 means the athlete is aiming
   * for 8 reps per set.
   */
  targetReps: number;
}

export interface WorkoutProgram {
  id: string;

  /**
   * User-defined program name.
   *
   * Examples:
   * Push A
   * Pull Strength
   * Leg Day
   */
  name: string;

  category: WorkoutCategory;

  /**
   * Optional muscles the athlete
   * specifically wants to emphasize.
   *
   * Example:
   * ["Chest", "Triceps"]
   */
  targetMuscles: string[];

  /**
   * Exercise order matters.
   *
   * The first exercise in this array
   * will be the first exercise during
   * the workout.
   */
  exercises: ProgramExercise[];

  createdAt: number;
  updatedAt: number;
}

export interface CreateProgramInput {
  name: string;
  category: WorkoutCategory;
  targetMuscles: string[];
  exercises: ProgramExercise[];
}

export interface UpdateProgramInput {
  name?: string;
  category?: WorkoutCategory;
  targetMuscles?: string[];
  exercises?: ProgramExercise[];
}