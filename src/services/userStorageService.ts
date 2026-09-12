import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  auth,
} from '../config/firebase';

const MIGRATION_KEY =
  '@nomosfit/account_storage_migration/v1';

export const LEGACY_PROGRAMS_KEY =
  '@nomosfit/workout_programs/v1';

export const LEGACY_HISTORY_KEY =
  '@nomosfit/workout_history/v1';

function getUid() {
  const uid =
    auth.currentUser?.uid;

  if (!uid) {
    throw new Error(
      'No signed-in user is available for local storage.'
    );
  }

  return uid;
}

export function getProgramsStorageKey() {
  return (
    `@nomosfit/users/${getUid()}` +
    '/programs/v1'
  );
}

export function getHistoryStorageKey() {
  return (
    `@nomosfit/users/${getUid()}` +
    '/history/v1'
  );
}

function getMigrationMarker(
  uid: string
) {
  return (
    `${MIGRATION_KEY}/${uid}`
  );
}

/*
 * Migrates the old device-wide storage
 * into the currently signed-in account.
 *
 * This runs only once for that UID.
 */
export async function migrateLegacyLocalDataForCurrentUser() {
  const uid =
    getUid();

  const marker =
    getMigrationMarker(
      uid
    );

  const alreadyMigrated =
    await AsyncStorage.getItem(
      marker
    );

  if (
    alreadyMigrated ===
    'true'
  ) {
    return;
  }

  const programsKey =
    getProgramsStorageKey();

  const historyKey =
    getHistoryStorageKey();

  const [
    existingPrograms,
    existingHistory,
    legacyPrograms,
    legacyHistory,
  ] =
    await Promise.all([
      AsyncStorage.getItem(
        programsKey
      ),

      AsyncStorage.getItem(
        historyKey
      ),

      AsyncStorage.getItem(
        LEGACY_PROGRAMS_KEY
      ),

      AsyncStorage.getItem(
        LEGACY_HISTORY_KEY
      ),
    ]);

  const writes:
    Promise<void>[] = [];

  /*
   * Only migrate into an empty scoped
   * location. Never overwrite data
   * already belonging to this account.
   */
  if (
    existingPrograms ===
      null &&
    legacyPrograms !==
      null
  ) {
    writes.push(
      AsyncStorage.setItem(
        programsKey,
        legacyPrograms
      )
    );
  }

  if (
    existingHistory ===
      null &&
    legacyHistory !==
      null
  ) {
    writes.push(
      AsyncStorage.setItem(
        historyKey,
        legacyHistory
      )
    );
  }

  await Promise.all(
    writes
  );

  /*
   * Mark first, then remove legacy
   * device-wide data.
   *
   * That ensures another Firebase
   * account cannot inherit the same
   * workouts later.
   */
  await AsyncStorage.setItem(
    marker,
    'true'
  );

  await AsyncStorage.multiRemove([
    LEGACY_PROGRAMS_KEY,
    LEGACY_HISTORY_KEY,
  ]);
}

export async function clearCurrentUserLocalData() {
  const uid =
    getUid();

  await AsyncStorage.multiRemove([
    getProgramsStorageKey(),
    getHistoryStorageKey(),

    /*
     * Remove migration marker too.
     */
    getMigrationMarker(
      uid
    ),
  ]);
}