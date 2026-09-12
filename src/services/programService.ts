import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  auth,
} from '../config/firebase';

import type {
  ProgramExercise,
  WorkoutCategory,
  WorkoutProgram,
} from '../types/program';

/*
 * Old device-wide storage key.
 *
 * Used only for one-time migration.
 */
const LEGACY_STORAGE_KEY =
  '@nomosfit/workout_programs/v1';

const VALID_CATEGORIES:
  WorkoutCategory[] = [
    'PUSH',
    'PULL',
    'CORE',
    'LEGS',
    'FULL BODY',
  ];

export type NewWorkoutProgram =
  Omit<
    WorkoutProgram,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
  > &
  Partial<
    Pick<
      WorkoutProgram,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
    >
  >;

function getCurrentUserId() {
  const uid =
    auth.currentUser?.uid;

  if (!uid) {
    throw new Error(
      'No signed-in user is available for program storage.'
    );
  }

  return uid;
}

function getStorageKey(
  uid: string
) {
  return (
    `@nomosfit/users/${uid}` +
    '/programs/v1'
  );
}

function createId() {
  return (
    `program-${Date.now()}-` +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function normalizeExercise(
  value: unknown,
  index: number
): ProgramExercise | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const data =
    value as Partial<ProgramExercise>;

  const name =
    typeof data.name ===
    'string'
      ? data.name.trim()
      : '';

  if (!name) {
    return null;
  }

  return {
    id:
      typeof data.id ===
        'string' &&
      data.id
        ? data.id
        : `exercise-${Date.now()}-${index}`,

    name,

    sets:
      Math.max(
        1,
        Math.round(
          Number(
            data.sets ?? 1
          )
        )
      ),

    targetReps:
      Math.max(
        1,
        Math.round(
          Number(
            data.targetReps ??
              1
          )
        )
      ),
  };
}

function normalizeCategory(
  value: unknown
): WorkoutCategory {
  if (
    typeof value ===
      'string' &&
    VALID_CATEGORIES.includes(
      value as WorkoutCategory
    )
  ) {
    return value as WorkoutCategory;
  }

  return 'FULL BODY';
}

function normalizeProgram(
  value: unknown
): WorkoutProgram | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const data =
    value as Partial<WorkoutProgram>;

  const name =
    typeof data.name ===
    'string'
      ? data.name.trim()
      : '';

  if (!name) {
    return null;
  }

  const rawExercises =
    Array.isArray(
      data.exercises
    )
      ? data.exercises
      : [];

  const exercises =
    rawExercises
      .map(
        (
          exercise,
          index
        ) =>
          normalizeExercise(
            exercise,
            index
          )
      )
      .filter(
        (
          exercise
        ): exercise is ProgramExercise =>
          exercise !== null
      );

  const targetMuscles =
    Array.isArray(
      data.targetMuscles
    )
      ? data.targetMuscles
          .filter(
            (
              muscle
            ): muscle is string =>
              typeof muscle ===
              'string'
          )
          .map(
            (muscle) =>
              muscle.trim()
          )
          .filter(Boolean)
      : [];

  const now =
    Date.now();

  return {
    id:
      typeof data.id ===
        'string' &&
      data.id
        ? data.id
        : createId(),

    name,

    category:
      normalizeCategory(
        data.category
      ),

    targetMuscles,

    exercises,

    createdAt:
      Number(
        data.createdAt ??
          now
      ),

    updatedAt:
      Number(
        data.updatedAt ??
          data.createdAt ??
          now
      ),
  };
}

/*
 * ====================================
 * LEGACY MIGRATION
 * ====================================
 *
 * The currently signed-in account gets
 * the old device-wide programs once.
 *
 * The legacy key is then removed so a
 * second account can never inherit them.
 */
async function migrateLegacyPrograms(
  uid: string
) {
  const scopedKey =
    getStorageKey(
      uid
    );

  const [
    scopedPrograms,
    legacyPrograms,
  ] =
    await Promise.all([
      AsyncStorage.getItem(
        scopedKey
      ),

      AsyncStorage.getItem(
        LEGACY_STORAGE_KEY
      ),
    ]);

  if (
    legacyPrograms ===
    null
  ) {
    return;
  }

  /*
   * Only copy legacy data if this
   * account doesn't already have its
   * own program storage.
   */
  if (
    scopedPrograms ===
    null
  ) {
    await AsyncStorage.setItem(
      scopedKey,
      legacyPrograms
    );
}

  /*
   * Critical:
   *
   * Always remove the shared key after
   * the current signed-in account gets
   * first opportunity to migrate it.
   */
  await AsyncStorage.removeItem(
    LEGACY_STORAGE_KEY
  );
}

async function writePrograms(
  uid: string,
  programs:
    WorkoutProgram[]
) {
  await AsyncStorage.setItem(
    getStorageKey(
      uid
    ),
    JSON.stringify(
      programs
    )
  );
}

/*
 * ====================================
 * LOAD
 * ====================================
 */
export async function getWorkoutPrograms():
Promise<WorkoutProgram[]> {
  const uid =
    getCurrentUserId();

  await migrateLegacyPrograms(
    uid
  );

  const raw =
    await AsyncStorage.getItem(
      getStorageKey(
        uid
      )
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
        normalizeProgram
      )
      .filter(
        (
          program
        ): program is WorkoutProgram =>
          program !== null
      )
      .sort(
        (
          a,
          b
        ) =>
          b.updatedAt -
          a.updatedAt
      );
  } catch (error) {
    console.error(
      'Program storage parse error:',
      error
    );

    return [];
  }
}

/*
 * Alias for compatibility.
 */
export const getPrograms =
  getWorkoutPrograms;

/*
 * ====================================
 * CREATE
 * ====================================
 */
export async function createWorkoutProgram(
  input:
    NewWorkoutProgram |
    WorkoutProgram
): Promise<WorkoutProgram> {
  const uid =
    getCurrentUserId();

  await migrateLegacyPrograms(
    uid
  );

  const programs =
    await getWorkoutPrograms();

  const now =
    Date.now();

  const program:
    WorkoutProgram = {
    id:
      input.id ||
      createId(),

    name:
      input.name.trim(),

    category:
      normalizeCategory(
        input.category
      ),

    targetMuscles:
      Array.isArray(
        input.targetMuscles
      )
        ? input.targetMuscles
            .map(
              (muscle) =>
                muscle.trim()
            )
            .filter(Boolean)
        : [],

    exercises:
      input.exercises
        .map(
          (
            exercise,
            index
          ) =>
            normalizeExercise(
              exercise,
              index
            )
        )
        .filter(
          (
            exercise
          ): exercise is ProgramExercise =>
            exercise !== null
        ),

    createdAt:
      input.createdAt ??
      now,

    updatedAt:
      now,
  };

  if (!program.name) {
    throw new Error(
      'Program name is required.'
    );
  }

  if (
    program.exercises.length ===
    0
  ) {
    throw new Error(
      'Add at least one exercise.'
    );
  }

  const withoutDuplicate =
    programs.filter(
      (item) =>
        item.id !==
        program.id
    );

  const updated = [
    program,
    ...withoutDuplicate,
  ].sort(
    (
      a,
      b
    ) =>
      b.updatedAt -
      a.updatedAt
  );

  await writePrograms(
    uid,
    updated
  );

  return program;
}

export const createProgram =
  createWorkoutProgram;

/*
 * ====================================
 * UPDATE
 * ====================================
 */
export async function updateWorkoutProgram(
  idOrProgram:
    string |
    WorkoutProgram,
  updates:
    Partial<WorkoutProgram> =
      {}
): Promise<WorkoutProgram> {
  const uid =
    getCurrentUserId();

  await migrateLegacyPrograms(
    uid
  );

  const programs =
    await getWorkoutPrograms();

  const id =
    typeof idOrProgram ===
    'string'
      ? idOrProgram
      : idOrProgram.id;

  const incoming =
    typeof idOrProgram ===
    'string'
      ? updates
      : idOrProgram;

  const existing =
    programs.find(
      (program) =>
        program.id === id
    );

  if (!existing) {
    throw new Error(
      'Program not found.'
    );
  }

  const now =
    Date.now();

  const merged =
    normalizeProgram({
      ...existing,
      ...incoming,

      id:
        existing.id,

      createdAt:
        existing.createdAt,

      updatedAt:
        now,
    });

  if (!merged) {
    throw new Error(
      'Invalid program data.'
    );
  }

  if (
    merged.exercises.length ===
    0
  ) {
    throw new Error(
      'Add at least one exercise.'
    );
  }

  const updated =
    programs
      .map(
        (program) =>
          program.id === id
            ? merged
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

  await writePrograms(
    uid,
    updated
  );

  return merged;
}

export const updateProgram =
  updateWorkoutProgram;

/*
 * ====================================
 * DELETE
 * ====================================
 */
export async function deleteWorkoutProgram(
  idOrProgram:
    string |
    WorkoutProgram
): Promise<void> {
  const uid =
    getCurrentUserId();

  await migrateLegacyPrograms(
    uid
  );

  const id =
    typeof idOrProgram ===
    'string'
      ? idOrProgram
      : idOrProgram.id;

  const programs =
    await getWorkoutPrograms();

  const updated =
    programs.filter(
      (program) =>
        program.id !== id
    );

  await writePrograms(
    uid,
    updated
  );
}

export const deleteProgram =
  deleteWorkoutProgram;

/*
 * ====================================
 * CLEAR CURRENT ACCOUNT
 * ====================================
 */
export async function clearWorkoutPrograms() {
  const uid =
    getCurrentUserId();

  await AsyncStorage.removeItem(
    getStorageKey(
      uid
    )
  );
}

export const clearPrograms =
  clearWorkoutPrograms;

/*
 * Used by permanent account deletion.
 */
export async function clearProgramsForUser(
  uid: string
) {
  await AsyncStorage.removeItem(
    getStorageKey(
      uid
    )
  );
}