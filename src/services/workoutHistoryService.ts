import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  auth,
} from '../config/firebase';

import type {
  WorkoutSession,
} from '../types/history';

import type {
  CompletedWorkoutSet,
} from '../types/workout';

/*
 * OLD device-wide key.
 *
 * We keep this only so we can migrate the
 * existing history one time.
 */
const LEGACY_STORAGE_KEY =
  '@nomosfit/workout_history/v1';

/*
 * Each Firebase user now gets their own
 * completely separate history key:
 *
 * @nomosfit/users/UID/history/v1
 */
function getCurrentUserId() {
  const uid =
    auth.currentUser?.uid;

  if (!uid) {
    throw new Error(
      'No signed-in user is available for workout history.'
    );
  }

  return uid;
}

function getStorageKey(
  uid: string
) {
  return (
    `@nomosfit/users/${uid}` +
    '/history/v1'
  );
}

function normalizeSet(
  value: unknown
): CompletedWorkoutSet | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const data =
    value as Partial<CompletedWorkoutSet>;

  if (
    typeof data.id !==
      'string' ||
    typeof data.exerciseId !==
      'string' ||
    typeof data.exerciseName !==
      'string'
  ) {
    return null;
  }

  return {
    id:
      data.id,

    exerciseId:
      data.exerciseId,

    exerciseName:
      data.exerciseName,

    exerciseIndex:
      Number(
        data.exerciseIndex ?? 0
      ),

    setNumber:
      Number(
        data.setNumber ?? 1
      ),

    targetReps:
      Number(
        data.targetReps ?? 0
      ),

    reps:
      Number(
        data.reps ?? 0
      ),

    weight:
      Number(
        data.weight ?? 0
      ),

    completedAt:
      Number(
        data.completedAt ?? 0
      ),
  };
}

function normalizeSession(
  value: unknown
): WorkoutSession | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const data =
    value as Partial<WorkoutSession>;

  if (
    typeof data.id !==
      'string' ||
    typeof data.programId !==
      'string' ||
    typeof data.programName !==
      'string'
  ) {
    return null;
  }

  const rawSets =
    Array.isArray(
      data.completedSets
    )
      ? data.completedSets
      : [];

  const completedSets =
    rawSets
      .map(
        normalizeSet
      )
      .filter(
        (
          set
        ): set is CompletedWorkoutSet =>
          set !== null
      );

  return {
    id:
      data.id,

    programId:
      data.programId,

    programName:
      data.programName,

    category:
      data.category ??
      'FULL BODY',

    startedAt:
      Number(
        data.startedAt ?? 0
      ),

    finishedAt:
      Number(
        data.finishedAt ?? 0
      ),

    durationSeconds:
      Number(
        data.durationSeconds ?? 0
      ),

    completedSets,
  };
}

/*
 * ====================================
 * LEGACY MIGRATION
 * ====================================
 *
 * Whichever signed-in account opens the
 * app first after this update receives
 * the existing device-wide history.
 *
 * After that, the old shared key is
 * deleted so no second account can
 * inherit the same history.
 */
async function migrateLegacyHistory(
  uid: string
) {
  const scopedKey =
    getStorageKey(
      uid
    );

  const existingScoped =
    await AsyncStorage.getItem(
      scopedKey
    );

  /*
   * This account already has its own
   * history. Never overwrite it.
   */
  if (
    existingScoped !== null
  ) {
    return;
  }

  const legacy =
    await AsyncStorage.getItem(
      LEGACY_STORAGE_KEY
    );

  if (
    legacy === null
  ) {
    return;
  }

  /*
   * Copy legacy history into the current
   * Firebase account.
   */
  await AsyncStorage.setItem(
    scopedKey,
    legacy
  );

  /*
   * Critical:
   *
   * Remove device-wide history so another
   * Firebase account cannot inherit it.
   */
  await AsyncStorage.removeItem(
    LEGACY_STORAGE_KEY
  );
}

export async function getWorkoutHistory():
Promise<WorkoutSession[]> {
  const uid =
    getCurrentUserId();

  await migrateLegacyHistory(
    uid
  );

  const storageKey =
    getStorageKey(
      uid
    );

  const raw =
    await AsyncStorage.getItem(
      storageKey
    );

  if (!raw) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(
        raw
      );

    if (
      !Array.isArray(
        parsed
      )
    ) {
      return [];
    }

    return parsed
      .map(
        normalizeSession
      )
      .filter(
        (
          session
        ): session is WorkoutSession =>
          session !== null
      )
      .sort(
        (
          a,
          b
        ) =>
          b.finishedAt -
          a.finishedAt
      );
  } catch (error) {
    console.error(
      'Workout history parse error:',
      error
    );

    return [];
  }
}

export async function saveWorkoutSession(
  session: WorkoutSession
) {
  const uid =
    getCurrentUserId();

  await migrateLegacyHistory(
    uid
  );

  const storageKey =
    getStorageKey(
      uid
    );

  const history =
    await getWorkoutHistory();

  /*
   * Remove an existing version first.
   *
   * This keeps the save idempotent and
   * prevents duplicate workout cards.
   */
  const withoutDuplicate =
    history.filter(
      (item) =>
        item.id !==
        session.id
    );

  const updated = [
    session,
    ...withoutDuplicate,
  ].sort(
    (
      a,
      b
    ) =>
      b.finishedAt -
      a.finishedAt
  );

  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify(
      updated
    )
  );
}

export async function clearWorkoutHistory() {
  const uid =
    getCurrentUserId();

  await AsyncStorage.removeItem(
    getStorageKey(
      uid
    )
  );
}

/*
 * Useful later for account deletion.
 */
export async function clearWorkoutHistoryForUser(
  uid: string
) {
  await AsyncStorage.removeItem(
    getStorageKey(
      uid
    )
  );
}