/*
 * ============================================================
 * ROUTINE + TRAINING-SETTINGS CLOUD SYNC
 * ============================================================
 *
 * Each routine is one Firestore document, with its training
 * settings (mode, rest time, starting weights) stored inside it:
 *
 *   users/{uid}/programs/{programId}
 *
 * The phone stays the place you edit. This module compares the
 * phone with the cloud and moves whatever is newer, both ways.
 *
 * Rules it follows:
 *
 *   - Newest edit wins, judged by the routine's updatedAt time.
 *   - Removing a routine leaves a small "deleted" marker in the
 *     cloud, so it is removed on your other devices too and does
 *     not come back on the next sync.
 *   - Editing a routine after it was removed elsewhere brings it
 *     back (the edit is newer than the removal).
 *   - Completed workout History is never touched here.
 *   - If the phone's saved routines cannot be read, nothing is
 *     uploaded or deleted. A read problem must never look like
 *     "the user deleted everything".
 *
 * Nothing in programService or programStore had to change: a
 * removed routine is detected by comparing against the list this
 * module last agreed with the cloud.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  Timestamp, collection, doc, getDocs, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { getWorkoutPrograms } from '../services/programService';
import type { ProgramExercise, WorkoutCategory, WorkoutProgram } from '../types/program';
import { normalizeSettings, type ProgramSettings } from './model';
import { useProgramSettings } from './preferences';
import { useProgramStore } from '../store/programStore';

const SCHEMA_VERSION = 1;
const NETWORK_TIMEOUT_MS = 20000;
const PULL_OVERLAP_MS = 10 * 60 * 1000;
const THROTTLE_MS = 60 * 1000;
const BATCH_SIZE = 200;
const CATEGORIES: WorkoutCategory[] = ['PUSH', 'PULL', 'CORE', 'LEGS', 'FULL BODY'];

/* Must match programService and preferences. */
const programsKey = (uid: string) => `@nomosfit/users/${uid}/programs/v1`;
const settingsKey = (uid: string) => `@nomosfit/users/${uid}/design-program-settings/v1`;
const stateKey = (uid: string) => `@nomosfit/users/${uid}/programs-sync/v1`;
const programsCollection = (uid: string) => collection(db, 'users', uid, 'programs');

interface SyncState {
  /** What this phone and the cloud last agreed on, per routine. */
  known: Record<string, { updatedAt: number; settings: string }>;
  /** Routines removed on this phone (or seen removed in the cloud). */
  tombstones: Record<string, { deletedAt: number; uploaded: boolean }>;
  lastPulledAt: number;
}

export interface ProgramSyncResult {
  status: 'synced' | 'offline' | 'signed-out' | 'skipped' | 'error';
  uploaded: number;
  /** True when routines or settings on this phone were changed by the sync. */
  changedLocal: boolean;
  error?: string;
}

async function readState(uid: string): Promise<SyncState> {
  try {
    const raw = await AsyncStorage.getItem(stateKey(uid));
    const data = raw ? JSON.parse(raw) : {};
    return {
      known: data && typeof data.known === 'object' && data.known ? data.known : {},
      tombstones: data && typeof data.tombstones === 'object' && data.tombstones ? data.tombstones : {},
      lastPulledAt: Number(data?.lastPulledAt) || 0,
    };
  } catch {
    // Unreadable state: start over with a full comparison. Nothing is deleted on that basis.
    return { known: {}, tombstones: {}, lastPulledAt: 0 };
  }
}

function withTimeout<T>(promise: Promise<T>, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), NETWORK_TIMEOUT_MS);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** Stable text form of a routine's settings, used only to notice changes. */
function settingsFingerprint(value: ProgramSettings | null | undefined): string {
  if (!value) return '';
  const settings = normalizeSettings(value);
  const weights = Object.keys(settings.initialWeights).sort().map(id => `${id}=${settings.initialWeights[id]}`).join(',');
  return `${settings.mode}|${settings.restSeconds}|${weights}`;
}

function remoteProgram(id: string, data: Record<string, unknown>): WorkoutProgram | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || !Array.isArray(data.exercises)) return null;
  const exercises: ProgramExercise[] = [];
  data.exercises.forEach((value, index) => {
    const item = (value && typeof value === 'object' ? value : {}) as Partial<ProgramExercise>;
    const exerciseName = typeof item.name === 'string' ? item.name.trim() : '';
    if (!exerciseName) return;
    exercises.push({
      id: typeof item.id === 'string' && item.id ? item.id : `exercise-${id}-${index}`,
      name: exerciseName,
      sets: Math.max(1, Math.round(Number(item.sets ?? 1)) || 1),
      targetReps: Math.max(1, Math.round(Number(item.targetReps ?? 1)) || 1),
    });
  });
  if (!exercises.length) return null;
  const updatedAt = Number(data.updatedAt) || 0;
  return {
    id, name, exercises,
    category: CATEGORIES.includes(data.category as WorkoutCategory) ? data.category as WorkoutCategory : 'FULL BODY',
    targetMuscles: Array.isArray(data.targetMuscles) ? data.targetMuscles.filter((m): m is string => typeof m === 'string') : [],
    createdAt: Number(data.createdAt) || updatedAt,
    updatedAt,
  };
}

async function runOnce(uid: string): Promise<ProgramSyncResult> {
  const result: ProgramSyncResult = { status: 'synced', uploaded: 0, changedLocal: false };
  const signedIn = () => auth.currentUser?.uid === uid;
  try {
    const network = await NetInfo.fetch();
    if (network.isConnected === false) return { ...result, status: 'offline' };

    /* ---- 1. Read the phone. Stop if anything is unreadable. ---- */
    const [rawPrograms, rawSettings] = await Promise.all([
      AsyncStorage.getItem(programsKey(uid)), AsyncStorage.getItem(settingsKey(uid)),
    ]);
    if (rawPrograms !== null && !Array.isArray(JSON.parse(rawPrograms))) throw new Error('Saved routines are unreadable');
    const parsedSettings: unknown = rawSettings ? JSON.parse(rawSettings) : {};
    if (!parsedSettings || typeof parsedSettings !== 'object' || Array.isArray(parsedSettings)) throw new Error('Saved training settings are unreadable');
    const settings = parsedSettings as Record<string, ProgramSettings | undefined>;
    if (!signedIn()) return { ...result, status: 'skipped' };
    const local = await getWorkoutPrograms();
    if (!signedIn()) return { ...result, status: 'skipped' };
    const localById = new Map(local.map(program => [program.id, program] as const));
    const state = await readState(uid);
    const startedAt = Date.now();

    /* A routine that exists on the phone again (recreated with its old ID) is no longer removed. */
    for (const id of Object.keys(state.tombstones)) if (localById.has(id)) delete state.tombstones[id];

    /* ---- 2. Notice routines removed on this phone since last time. ---- */
    if (rawPrograms !== null) {
      for (const id of Object.keys(state.known)) {
        if (!localById.has(id)) {
          if (!state.tombstones[id]) state.tombstones[id] = { deletedAt: startedAt, uploaded: false };
          delete state.known[id];
        }
      }
    }

    /* ---- 3. Read what changed in the cloud. ---- */
    // Routines missing from the phone although some were synced before: fetch everything, so they are restored.
    const lostLocalCopy = rawPrograms === null && Object.keys(state.known).length > 0;
    const source = state.lastPulledAt > 0 && !lostLocalCopy
      ? query(programsCollection(uid), where('syncedAt', '>', Timestamp.fromMillis(Math.max(0, state.lastPulledAt - PULL_OVERLAP_MS))))
      : programsCollection(uid);
    const snapshot = await withTimeout(getDocs(source), 'Routine download');
    if (snapshot.metadata.fromCache) throw new Error('Routine download was not served by Firebase');

    const upload = new Set<string>();                 // local routine ids to send
    const adopt = new Map<string, { program: WorkoutProgram; settings: ProgramSettings | null }>();
    const removeLocal = new Set<string>();

    snapshot.forEach(item => {
      const id = item.id;
      const data = item.data() as Record<string, unknown>;
      const remoteAt = Number(data.updatedAt) || 0;
      const mine = localById.get(id);
      const tombstone = state.tombstones[id];

      if (data.deleted === true) {
        if (mine && mine.updatedAt > remoteAt) { upload.add(id); delete state.tombstones[id]; return; } // edited after removal
        if (mine) removeLocal.add(id);
        state.tombstones[id] = { deletedAt: Math.max(tombstone?.deletedAt ?? 0, remoteAt), uploaded: true };
        delete state.known[id];
        return;
      }

      const program = remoteProgram(id, data);
      if (!program) return;
      const remoteSettings = data.settings && typeof data.settings === 'object' ? normalizeSettings(data.settings) : null;

      if (!mine) {
        if (tombstone && tombstone.deletedAt >= remoteAt) { tombstone.uploaded = false; return; } // removed here, later
        adopt.set(id, { program, settings: remoteSettings });
        delete state.tombstones[id];
        return;
      }
      if (remoteAt > mine.updatedAt) { adopt.set(id, { program, settings: remoteSettings }); return; }
      if (mine.updatedAt > remoteAt || settingsFingerprint(settings[id]) !== settingsFingerprint(remoteSettings)) { upload.add(id); return; }
      state.known[id] = { updatedAt: mine.updatedAt, settings: settingsFingerprint(settings[id]) };
    });

    /* ---- 4. Anything on the phone the cloud has not seen yet. ---- */
    for (const program of local) {
      if (adopt.has(program.id) || removeLocal.has(program.id)) continue;
      const known = state.known[program.id];
      if (!known || known.updatedAt !== program.updatedAt || known.settings !== settingsFingerprint(settings[program.id])) upload.add(program.id);
    }

    /* ---- 5. Upload routines and removal markers. ---- */
    const writes: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const id of upload) {
      const program = localById.get(id);
      if (!program) continue;
      writes.push({ id, data: {
        ...program, settings: settings[id] ? normalizeSettings(settings[id]) : null,
        deleted: false, ownerUid: uid, schemaVersion: SCHEMA_VERSION, syncedAt: serverTimestamp(),
      } });
    }
    for (const [id, tombstone] of Object.entries(state.tombstones)) {
      if (tombstone.uploaded || localById.has(id)) continue;
      writes.push({ id, data: { id, deleted: true, updatedAt: tombstone.deletedAt, ownerUid: uid, schemaVersion: SCHEMA_VERSION, syncedAt: serverTimestamp() } });
    }
    for (let start = 0; start < writes.length; start += BATCH_SIZE) {
      const batch = writeBatch(db);
      writes.slice(start, start + BATCH_SIZE).forEach(write => batch.set(doc(programsCollection(uid), write.id), write.data));
      await withTimeout(batch.commit(), 'Routine upload');
    }
    for (const write of writes) {
      if (write.data.deleted === true) state.tombstones[write.id].uploaded = true;
      else { const p = localById.get(write.id)!; state.known[write.id] = { updatedAt: p.updatedAt, settings: settingsFingerprint(settings[write.id]) }; }
    }
    result.uploaded = writes.length;

    /* ---- 6. Bring cloud changes onto the phone. ---- */
    if ((adopt.size || removeLocal.size) && signedIn()) {
      // Re-read first, so an edit made during this sync is not overwritten.
      const fresh = await getWorkoutPrograms();
      if (!signedIn()) return { ...result, status: 'skipped' };
      const unchanged = (id: string) => {
        const before = localById.get(id), now = fresh.find(program => program.id === id);
        return (!before && !now) || (!!before && !!now && before.updatedAt === now.updatedAt);
      };
      const next = fresh.filter(program => !(removeLocal.has(program.id) && unchanged(program.id)) && !(adopt.has(program.id) && unchanged(program.id)));
      const adopted: string[] = [];
      for (const [id, incoming] of adopt) {
        if (!unchanged(id)) continue; // edited meanwhile: the next sync sorts it out
        next.push(incoming.program); adopted.push(id);
      }
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      await AsyncStorage.setItem(programsKey(uid), JSON.stringify(next));
      for (const id of adopted) {
        const incoming = adopt.get(id)!;
        if (incoming.settings && signedIn()) await useProgramSettings.getState().save(id, incoming.settings);
        state.known[id] = { updatedAt: incoming.program.updatedAt, settings: settingsFingerprint(incoming.settings ?? settings[id]) };
      }
      result.changedLocal = true;
    }

    state.lastPulledAt = startedAt;
    await AsyncStorage.setItem(stateKey(uid), JSON.stringify(state));
    return result;
  } catch (error) {
    console.warn('Routine cloud sync failed:', error);
    return { ...result, status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

/*
 * One run at a time. A request that arrives mid-run shares that
 * run and schedules exactly one more, so a routine saved during a
 * sync is not left waiting.
 */
let active: Promise<ProgramSyncResult> | null = null;
let activeUid: string | null = null;
let again = false;
let lastAttempt = { uid: null as string | null, at: 0 };

export function syncPrograms(options?: { force?: boolean }): Promise<ProgramSyncResult> {
  const uid = auth.currentUser?.uid ?? null;
  if (!uid) return Promise.resolve({ status: 'signed-out', uploaded: 0, changedLocal: false });
  if (active && activeUid === uid) { again = true; return active; }
  const now = Date.now();
  if (!options?.force && lastAttempt.uid === uid && now - lastAttempt.at < THROTTLE_MS) {
    return Promise.resolve({ status: 'skipped', uploaded: 0, changedLocal: false });
  }
  lastAttempt = { uid, at: now };
  activeUid = uid;
  const run: Promise<ProgramSyncResult> = (async () => {
    let result = await runOnce(uid);
    while (again && result.status === 'synced' && auth.currentUser?.uid === uid) {
      again = false;
      const next = await runOnce(uid);
      result = { ...next, uploaded: result.uploaded + next.uploaded, changedLocal: result.changedLocal || next.changedLocal };
    }
    again = false;
    return result;
  })().finally(() => { if (active === run) { active = null; activeUid = null; } });
  active = run;
  return run;
}

/*
 * Sync, then refresh what is on screen if the cloud changed
 * anything on this phone. Never throws.
 */
let applyingRemote = false;
/** True while a sync is reloading the stores, so that reload is not mistaken for a user edit. */
export function isApplyingRemoteRoutines() { return applyingRemote; }
export async function syncRoutinesAndReload(options?: { force?: boolean }): Promise<ProgramSyncResult> {
  const uid = auth.currentUser?.uid ?? null;
  const result = await syncPrograms(options);
  if (result.changedLocal && uid && auth.currentUser?.uid === uid) {
    applyingRemote = true;
    try {
      await Promise.all([useProgramStore.getState().loadPrograms(), useProgramSettings.getState().load()]);
    } catch { /* The next screen focus reloads anyway. */ }
    finally { applyingRemote = false; }
  }
  return result;
}

/* ---- Account deletion (call while still signed in) ---- */
export async function deleteCloudProgramsForUser(uid: string) {
  const snapshot = await getDocs(programsCollection(uid));
  const refs = snapshot.docs.map(item => item.ref);
  for (let start = 0; start < refs.length; start += BATCH_SIZE) {
    const batch = writeBatch(db);
    refs.slice(start, start + BATCH_SIZE).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

export async function clearProgramSyncStateForUser(uid: string) {
  await AsyncStorage.removeItem(stateKey(uid));
}
