/*
 * ============================================================
 * WORKOUT CLOUD SYNC
 * ============================================================
 *
 * Every completed workout is stored in two places:
 *
 *   1. AsyncStorage   (instant, works offline — unchanged)
 *   2. Firestore      users/{uid}/workoutHistory/{sessionId}
 *
 * How it works:
 *
 *   - Saving a workout adds its ID to a pending list that is
 *     itself stored on the phone, so it survives app restarts.
 *   - A sync run uploads everything pending, then downloads any
 *     workouts that exist in Firestore but not on this phone
 *     (new phone, reinstall, second device).
 *   - The first sync for an account on a device queues every
 *     workout already on the phone, so old History is backed up
 *     too — not only workouts finished after this update.
 *
 * Safety rules:
 *
 *   - The Firestore document ID is the session ID, so uploading
 *     the same workout twice overwrites itself. No duplicates.
 *   - Download only ADDS missing workouts. It never replaces or
 *     removes anything already on the phone.
 *   - Nothing here deletes History when a routine is removed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import type { WorkoutSession } from '../types/history';
import { getWorkoutHistory } from './workoutHistoryService';

const SCHEMA_VERSION = 1;
const UPLOAD_BATCH_SIZE = 200;
const NETWORK_TIMEOUT_MS = 20000;

/*
 * When downloading only "what changed since last time", look
 * back a little further than the last download to cover clock
 * differences between the phone and the server.
 */
const PULL_OVERLAP_MS = 10 * 60 * 1000;

interface SyncState {
  pendingIds: string[];
  backfillQueued: boolean;
  lastPulledAt: number;
  lastSyncedAt: number | null;
}

export type WorkoutSyncStatus =
  | 'synced'
  | 'offline'
  | 'signed-out'
  | 'error';

export interface WorkoutSyncResult {
  status: WorkoutSyncStatus;
  uploaded: number;
  restored: number;
  pending: number;
  lastSyncedAt: number | null;
  error?: string;
}

const EMPTY_STATE: SyncState = {
  pendingIds: [],
  backfillQueued: false,
  lastPulledAt: 0,
  lastSyncedAt: null,
};

function getSyncStateKey(uid: string) {
  return `@nomosfit/users/${uid}/history-sync/v1`;
}

/* Must match workoutHistoryService. */
function getHistoryKey(uid: string) {
  return `@nomosfit/users/${uid}/history/v1`;
}

function historyCollection(uid: string) {
  return collection(db, 'users', uid, 'workoutHistory');
}

/*
 * ------------------------------------------------------------
 * Sync state (stored on the phone)
 * ------------------------------------------------------------
 *
 * All changes go through one queue so that "a workout was just
 * saved" and "a sync run just finished" can never overwrite
 * each other's update.
 */
let stateQueue: Promise<unknown> = Promise.resolve();

async function readState(uid: string): Promise<SyncState> {
  const raw = await AsyncStorage.getItem(getSyncStateKey(uid));

  if (!raw) {
    return { ...EMPTY_STATE };
  }

  try {
    const data = JSON.parse(raw) as Partial<SyncState>;

    return {
      pendingIds: Array.isArray(data.pendingIds)
        ? data.pendingIds.filter(
            (id): id is string => typeof id === 'string'
          )
        : [],
      backfillQueued: data.backfillQueued === true,
      lastPulledAt: Number(data.lastPulledAt ?? 0) || 0,
      lastSyncedAt:
        typeof data.lastSyncedAt === 'number'
          ? data.lastSyncedAt
          : null,
    };
  } catch {
    /*
     * Unreadable state: start over. backfillQueued = false
     * means the next sync re-queues everything on the phone,
     * so nothing is silently left un-uploaded.
     */
    return { ...EMPTY_STATE };
  }
}

function updateState(
  uid: string,
  change: (state: SyncState) => SyncState
): Promise<SyncState> {
  const run = async () => {
    const next = change(await readState(uid));

    await AsyncStorage.setItem(
      getSyncStateKey(uid),
      JSON.stringify(next)
    );

    return next;
  };

  const result = stateQueue.then(run, run);

  stateQueue = result.catch(() => undefined);

  return result;
}

function withTimeout<T>(promise: Promise<T>, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, NETWORK_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/*
 * ------------------------------------------------------------
 * Public: queue one workout for upload
 * ------------------------------------------------------------
 *
 * Call right after the workout is saved locally.
 */
export async function queueSessionForSync(
  uid: string,
  sessionId: string
) {
  await updateState(uid, (state) => ({
    ...state,
    pendingIds: state.pendingIds.includes(sessionId)
      ? state.pendingIds
      : [...state.pendingIds, sessionId],
  }));
}

export async function getWorkoutSyncInfo(uid: string) {
  const state = await readState(uid);

  return {
    pending: state.pendingIds.length,
    lastSyncedAt: state.lastSyncedAt,
  };
}

/*
 * ------------------------------------------------------------
 * Upload
 * ------------------------------------------------------------
 */
async function uploadPending(uid: string) {
  let state = await readState(uid);

  /* Local History belongs to whoever is signed in right now. */
  if (auth.currentUser?.uid !== uid) {
    return 0;
  }

  const local = await getWorkoutHistory();

  if (auth.currentUser?.uid !== uid) {
    return 0;
  }

  /*
   * First sync on this device: back up everything that is
   * already on the phone.
   */
  if (!state.backfillQueued) {
    const localIds = local.map((session) => session.id);

    state = await updateState(uid, (current) => ({
      ...current,
      backfillQueued: true,
      pendingIds: Array.from(
        new Set([...current.pendingIds, ...localIds])
      ),
    }));
  }

  if (state.pendingIds.length === 0) {
    return 0;
  }

  const byId = new Map(
    local.map((session) => [session.id, session] as const)
  );

  let uploaded = 0;

  for (
    let start = 0;
    start < state.pendingIds.length;
    start += UPLOAD_BATCH_SIZE
  ) {
    const ids = state.pendingIds.slice(
      start,
      start + UPLOAD_BATCH_SIZE
    );

    const batch = writeBatch(db);
    let writes = 0;

    ids.forEach((id) => {
      const session = byId.get(id);

      /* Queued but no longer on the phone: nothing to send. */
      if (!session) {
        return;
      }

      batch.set(doc(historyCollection(uid), id), {
        ...session,
        ownerUid: uid,
        schemaVersion: SCHEMA_VERSION,
        syncedAt: serverTimestamp(),
      });

      writes += 1;
    });

    if (writes > 0) {
      /*
       * Resolves only once the server has accepted the write.
       * If it times out the IDs stay pending and are sent
       * again next run, which is harmless (same document ID).
       */
      await withTimeout(batch.commit(), 'Workout upload');
    }

    uploaded += writes;

    const done = new Set(ids);

    await updateState(uid, (current) => ({
      ...current,
      pendingIds: current.pendingIds.filter(
        (id) => !done.has(id)
      ),
    }));
  }

  return uploaded;
}

/*
 * ------------------------------------------------------------
 * Download (restore)
 * ------------------------------------------------------------
 */
function toLocalSession(
  id: string,
  data: Record<string, unknown>
): WorkoutSession | null {
  if (
    typeof data.programId !== 'string' ||
    typeof data.programName !== 'string'
  ) {
    return null;
  }

  /* Drop the cloud-only fields; keep the workout itself. */
  const {
    ownerUid: _ownerUid,
    schemaVersion: _schemaVersion,
    syncedAt: _syncedAt,
    ...session
  } = data;

  return {
    ...(session as unknown as WorkoutSession),
    id,
  };
}

async function pullMissing(uid: string) {
  const state = await readState(uid);
  const startedAt = Date.now();

  const source =
    state.lastPulledAt > 0
      ? query(
          historyCollection(uid),
          where(
            'syncedAt',
            '>',
            Timestamp.fromMillis(
              Math.max(0, state.lastPulledAt - PULL_OVERLAP_MS)
            )
          )
        )
      : historyCollection(uid);

  const snapshot = await withTimeout(
    getDocs(source),
    'Workout download'
  );

  /*
   * Answered from the on-device cache, not the server, so it
   * says nothing about what is really in the cloud. Try again
   * next run.
   */
  if (snapshot.metadata.fromCache) {
    throw new Error('Workout download was not served by Firebase');
  }

  const remote: WorkoutSession[] = [];

  snapshot.forEach((item) => {
    const session = toLocalSession(item.id, item.data());

    if (session) {
      remote.push(session);
    }
  });

  let restored = 0;

  if (remote.length > 0 && auth.currentUser?.uid === uid) {
    const key = getHistoryKey(uid);
    const raw = await AsyncStorage.getItem(key);

    let local: WorkoutSession[] = [];

    try {
      const parsed = raw ? JSON.parse(raw) : [];

      local = Array.isArray(parsed) ? parsed : [];
    } catch {
      /*
       * The phone's History could not be read. Do not write
       * over it — stop here and leave it exactly as it is.
       */
      throw new Error('Local workout history is unreadable');
    }

    const known = new Set(local.map((session) => session?.id));

    const missing = remote.filter(
      (session) => !known.has(session.id)
    );

    if (missing.length > 0) {
      const merged = [...local, ...missing].sort(
        (a, b) =>
          Number(b?.finishedAt ?? 0) - Number(a?.finishedAt ?? 0)
      );

      await AsyncStorage.setItem(key, JSON.stringify(merged));

      restored = missing.length;
    }
  }

  await updateState(uid, (current) => ({
    ...current,
    lastPulledAt: startedAt,
  }));

  return restored;
}

/*
 * ------------------------------------------------------------
 * Public: run a sync
 * ------------------------------------------------------------
 *
 * Safe to call as often as you like. Calls made while a run is
 * in progress share that run, then trigger one more so a
 * workout saved mid-run is not left waiting.
 */
let activeRun: Promise<WorkoutSyncResult> | null = null;
let activeUid: string | null = null;
let runAgain = false;

async function runOnce(uid: string): Promise<WorkoutSyncResult> {
  let uploaded = 0;
  let restored = 0;

  try {
    const network = await NetInfo.fetch();

    if (network.isConnected === false) {
      const info = await getWorkoutSyncInfo(uid);

      return {
        status: 'offline',
        uploaded,
        restored,
        ...info,
      };
    }

    uploaded = await uploadPending(uid);
    restored = await pullMissing(uid);

    const state = await updateState(uid, (current) => ({
      ...current,
      lastSyncedAt: Date.now(),
    }));

    return {
      status: 'synced',
      uploaded,
      restored,
      pending: state.pendingIds.length,
      lastSyncedAt: state.lastSyncedAt,
    };
  } catch (error) {
    console.warn('Workout cloud sync failed:', error);

    const info = await getWorkoutSyncInfo(uid).catch(() => ({
      pending: 0,
      lastSyncedAt: null,
    }));

    return {
      status: 'error',
      uploaded,
      restored,
      ...info,
      error:
        error instanceof Error ? error.message : String(error),
    };
  }
}

export function syncWorkoutHistory(): Promise<WorkoutSyncResult> {
  const uid = auth.currentUser?.uid ?? null;

  if (!uid) {
    return Promise.resolve({
      status: 'signed-out',
      uploaded: 0,
      restored: 0,
      pending: 0,
      lastSyncedAt: null,
    });
  }

  if (activeRun && activeUid === uid) {
    runAgain = true;

    return activeRun;
  }

  activeUid = uid;

  const run: Promise<WorkoutSyncResult> = (async () => {
    let result = await runOnce(uid);

    while (
      runAgain &&
      result.status === 'synced' &&
      auth.currentUser?.uid === uid
    ) {
      runAgain = false;

      const next = await runOnce(uid);

      result = {
        ...next,
        uploaded: result.uploaded + next.uploaded,
        restored: result.restored + next.restored,
      };
    }

    runAgain = false;

    return result;
  })().finally(() => {
    if (activeRun === run) {
      activeRun = null;
      activeUid = null;
    }
  });

  activeRun = run;

  return run;
}

/*
 * ------------------------------------------------------------
 * Account deletion
 * ------------------------------------------------------------
 *
 * Call while the user is still signed in.
 */
export async function deleteCloudWorkoutHistoryForUser(
  uid: string
) {
  const snapshot = await getDocs(historyCollection(uid));
  const refs = snapshot.docs.map((item) => item.ref);

  for (
    let start = 0;
    start < refs.length;
    start += UPLOAD_BATCH_SIZE
  ) {
    const batch = writeBatch(db);

    refs
      .slice(start, start + UPLOAD_BATCH_SIZE)
      .forEach((ref) => batch.delete(ref));

    await batch.commit();
  }
}

export async function clearWorkoutSyncStateForUser(uid: string) {
  await AsyncStorage.removeItem(getSyncStateKey(uid));
}
