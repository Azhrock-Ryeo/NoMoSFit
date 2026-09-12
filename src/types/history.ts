import type {
  WorkoutCategory,
} from './program';

import type {
  CompletedWorkoutSet,
} from './workout';

export interface WorkoutSession {
  /**
   * Same ID as the live workout
   * that produced this session.
   */
  id: string;

  programId: string;
  programName: string;

  category: WorkoutCategory;

  startedAt: number;
  finishedAt: number;

  durationSeconds: number;

  completedSets: CompletedWorkoutSet[];
}