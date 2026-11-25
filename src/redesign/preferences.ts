import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { auth } from '../config/firebase';
import { normalizeSettings, type ProgramSettings } from './model';

/** Additive account-scoped metadata. Existing program/history storage is not rewritten. */
const keyFor = (uid: string) => `@nomosfit/users/${uid}/design-program-settings/v1`;
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(action: () => Promise<T>): Promise<T> {
  const job = queue.then(action, action); queue = job.catch(() => undefined); return job;
}
async function read(uid: string): Promise<Record<string, ProgramSettings>> {
  const raw = await AsyncStorage.getItem(keyFor(uid));
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Training settings could not be read. Your programs have not been changed.');
  return Object.fromEntries(Object.entries(parsed).map(([id, value]) => [id, normalizeSettings(value)]));
}
interface PreferencesState {
  ownerUid: string | null; values: Record<string, ProgramSettings>; loaded: boolean; error: string | null;
  load: () => Promise<void>;
  save: (programId: string, value: ProgramSettings) => Promise<void>;
  remove: (programId: string) => Promise<void>;
  reset: () => void;
}
export const useProgramSettings = create<PreferencesState>((set) => ({
  ownerUid: null, values: {}, loaded: false, error: null,
  reset: () => set({ ownerUid: null, values: {}, loaded: false, error: null }),
  load: async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { set({ ownerUid: null, values: {}, loaded: false, error: null }); return; }
    set(current => ({ ownerUid: uid, values: current.ownerUid === uid ? current.values : {}, loaded: false, error: null }));
    try {
      const values = await serialized(() => read(uid));
      if (auth.currentUser?.uid === uid) set({ ownerUid: uid, values, loaded: true });
    } catch (err) {
      if (auth.currentUser?.uid === uid) set({ loaded: true, error: err instanceof Error ? err.message : 'Training settings could not be read.' });
    }
  },
  save: (programId, value) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Promise.reject(new Error('Sign in before saving a program.'));
    const snapshot = normalizeSettings(value);
    return serialized(async () => {
      if (auth.currentUser?.uid !== uid) throw new Error('Account changed. Save cancelled.');
      const values = await read(uid);
      if (auth.currentUser?.uid !== uid) throw new Error('Account changed. Save cancelled.');
      values[programId] = snapshot;
      await AsyncStorage.setItem(keyFor(uid), JSON.stringify(values));
      if (auth.currentUser?.uid === uid) set({ ownerUid: uid, values, loaded: true, error: null });
    });
  },
  remove: (programId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Promise.resolve();
    return serialized(async () => {
      if (auth.currentUser?.uid !== uid) throw new Error('Account changed. Delete cancelled.');
      const values = await read(uid); delete values[programId];
      if (auth.currentUser?.uid !== uid) throw new Error('Account changed. Delete cancelled.');
      await AsyncStorage.setItem(keyFor(uid), JSON.stringify(values));
      if (auth.currentUser?.uid === uid) set({ ownerUid: uid, values, loaded: true });
    });
  },
}));
export function settingsFor(id: string): ProgramSettings {
  const state = useProgramSettings.getState();
  return normalizeSettings(state.ownerUid === auth.currentUser?.uid ? state.values[id] : undefined);
}

/** Included in the existing permanent-account deletion cleanup. */
export function clearProgramDesignSettingsForUser(uid: string): Promise<void> {
  return serialized(async () => {
    await AsyncStorage.removeItem(keyFor(uid));
    if (useProgramSettings.getState().ownerUid === uid) useProgramSettings.getState().reset();
  });
}
