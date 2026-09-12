import type {
  WorkoutSession,
} from '../types/history';

import {
  compareSet,
} from './progression';

interface WorkoutInsightResult {
  title: string;
  message: string;

  improvedExercises: number;
  declinedExercises: number;

  volumeDelta: number | null;
}

function getVolume(
  session: WorkoutSession
) {
  return session.completedSets.reduce(
    (
      total,
      set
    ) =>
      total +
      set.reps *
        set.weight,
    0
  );
}

export function generateWorkoutInsight(
  session: WorkoutSession,
  previousSession?: WorkoutSession
): WorkoutInsightResult {
  /**
   * First ever attempt for this
   * program.
   */
  if (!previousSession) {
    const exerciseCount =
      new Set(
        session.completedSets.map(
          (set) =>
            set.exerciseId
        )
      ).size;

    return {
      title:
        'Baseline established',

      message:
        `You completed ${exerciseCount} ` +
        `${exerciseCount === 1 ? 'exercise' : 'exercises'} ` +
        `and ${session.completedSets.length} working sets. ` +
        `Your next ${session.programName} session can now be compared against this performance.`,

      improvedExercises: 0,
      declinedExercises: 0,

      volumeDelta: null,
    };
  }

  const improved =
    new Set<string>();

  const declined =
    new Set<string>();

  const mixed =
    new Set<string>();

  session.completedSets.forEach(
    (set) => {
      const previousSet =
        previousSession.completedSets.find(
          (previous) =>
            previous.exerciseId ===
              set.exerciseId &&
            previous.setNumber ===
              set.setNumber
        );

      const comparison =
        compareSet(
          previousSet,
          set.reps,
          set.weight
        );

      if (!comparison) {
        return;
      }

      if (
        comparison.improved
      ) {
        improved.add(
          set.exerciseName
        );

        return;
      }

      if (
        comparison.declined
      ) {
        declined.add(
          set.exerciseName
        );

        return;
      }

      if (
        comparison.mixed
      ) {
        mixed.add(
          set.exerciseName
        );
      }
    }
  );

  const currentVolume =
    getVolume(session);

  const previousVolume =
    getVolume(
      previousSession
    );

  const volumeDelta =
    currentVolume -
    previousVolume;

  const firstImprovement =
    Array.from(
      improved
    )[0];

  /**
   * Clear positive progression.
   */
  if (
    improved.size > 0 &&
    declined.size === 0
  ) {
    let message =
      firstImprovement
        ? `You progressed on ${firstImprovement}`
        : 'You made measurable progress';

    if (
      improved.size > 1
    ) {
      message +=
        ` and ${improved.size - 1} ` +
        `${improved.size - 1 === 1 ? 'other exercise' : 'other exercises'}`;
    }

    message += '. ';

    if (
      volumeDelta > 0
    ) {
      message +=
        `Total training volume also increased by ${Math.round(
          volumeDelta
        ).toLocaleString()} kg. `;
    }

    message +=
      'Keep the progression controlled and repeatable next session.';

    return {
      title:
        'Progress moving up',

      message,

      improvedExercises:
        improved.size,

      declinedExercises: 0,

      volumeDelta,
    };
  }

  /**
   * Some things improved while
   * others dropped.
   */
  if (
    improved.size > 0 &&
    declined.size > 0
  ) {
    return {
      title:
        'Mixed progression',

      message:
        `You improved on ${improved.size} ` +
        `${improved.size === 1 ? 'exercise' : 'exercises'}, ` +
        `while ${declined.size} ` +
        `${declined.size === 1 ? 'exercise finished' : 'exercises finished'} ` +
        `below your previous performance. ` +
        `Use the next session to confirm which changes are sustainable.`,

      improvedExercises:
        improved.size,

      declinedExercises:
        declined.size,

      volumeDelta,
    };
  }

  /**
   * No clear progression, but
   * workload was broadly maintained.
   */
  if (
    improved.size === 0 &&
    declined.size === 0
  ) {
    if (
      mixed.size > 0
    ) {
      return {
        title:
          'Different stimulus',

        message:
          `This session traded reps and load across ${mixed.size} ` +
          `${mixed.size === 1 ? 'exercise' : 'exercises'}, ` +
          `so there was no clear progression or regression. ` +
          `Another similar session will give a better comparison.`,

        improvedExercises: 0,
        declinedExercises: 0,

        volumeDelta,
      };
    }

    return {
      title:
        'Performance maintained',

      message:
        'You closely matched your previous session. ' +
        'Consistency is useful here—when the current workload feels controlled, ' +
        'increase either reps or weight gradually.',

      improvedExercises: 0,
      declinedExercises: 0,

      volumeDelta,
    };
  }

  /**
   * More regression than improvement.
   */
  return {
    title:
      'Below last session',

    message:
      `Performance was lower on ${declined.size} ` +
      `${declined.size === 1 ? 'exercise' : 'exercises'} compared with last time. ` +
      `Avoid forcing progression; repeat the workload and aim for cleaner, more consistent sets next session.`,

    improvedExercises:
      improved.size,

    declinedExercises:
      declined.size,

    volumeDelta,
  };
}