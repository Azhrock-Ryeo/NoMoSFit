import type {
  WorkoutSession,
} from '../types/history';

import type {
  CompletedWorkoutSet,
} from '../types/workout';

export interface SetComparison {
  previous: CompletedWorkoutSet;

  weightDelta: number;
  repsDelta: number;

  improved: boolean;
  declined: boolean;
  mixed: boolean;
  unchanged: boolean;
}

export function findPreviousSet(
  session: WorkoutSession | undefined,
  exerciseId: string,
  setNumber: number
): CompletedWorkoutSet | undefined {
  if (!session) {
    return undefined;
  }

  return session.completedSets.find(
    (completedSet) =>
      completedSet.exerciseId ===
        exerciseId &&
      completedSet.setNumber ===
        setNumber
  );
}

export function compareSet(
  previous: CompletedWorkoutSet | undefined,
  currentReps: number,
  currentWeight: number
): SetComparison | null {
  if (!previous) {
    return null;
  }

  const weightDelta =
    Math.round(
      (currentWeight -
        previous.weight) *
        2
    ) / 2;

  const repsDelta =
    currentReps -
    previous.reps;

  const weightBetter =
    weightDelta > 0;

  const repsBetter =
    repsDelta > 0;

  const weightWorse =
    weightDelta < 0;

  const repsWorse =
    repsDelta < 0;

  const unchanged =
    weightDelta === 0 &&
    repsDelta === 0;

  /**
   * Clear improvement:
   *
   * - more weight without losing reps
   * - more reps without losing weight
   */
  const improved =
    (weightBetter &&
      repsDelta >= 0) ||
    (repsBetter &&
      weightDelta >= 0);

  /**
   * Clear regression:
   *
   * - less weight without gaining reps
   * - fewer reps without gaining weight
   */
  const declined =
    (weightWorse &&
      repsDelta <= 0) ||
    (repsWorse &&
      weightDelta <= 0);

  /**
   * Example:
   * +5 kg but -2 reps
   *
   * We don't automatically call this
   * better or worse.
   */
  const mixed =
    !improved &&
    !declined &&
    !unchanged;

  return {
    previous,

    weightDelta,
    repsDelta,

    improved,
    declined,
    mixed,
    unchanged,
  };
}

export function formatWeightDelta(
  value: number
) {
  if (value === 0) {
    return 'Same weight';
  }

  const sign =
    value > 0 ? '+' : '';

  return `${sign}${value.toFixed(
    1
  )} kg`;
}

export function formatRepDelta(
  value: number
) {
  if (value === 0) {
    return 'Same reps';
  }

  const sign =
    value > 0 ? '+' : '';

  const unit =
    Math.abs(value) === 1
      ? 'rep'
      : 'reps';

  return `${sign}${value} ${unit}`;
}