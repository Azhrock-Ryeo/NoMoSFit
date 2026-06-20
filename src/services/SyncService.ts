import NetInfo from '@react-native-community/netinfo';
import { collection, addDoc } from 'firebase/firestore';
import { database } from '../lib/database';

export async function syncPendingSessions(uid: string) {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  try {
    const { db } = await import('../config/firebase');
    const sessionsCollection = database.get('workout_sessions');
    const allSessions = await sessionsCollection.query().fetch();
    const pending = allSessions.filter((s: any) => s.syncStatus === 'pending');

    for (const session of pending) {
      try {
        const docRef = await addDoc(collection(db, 'workoutSessions'), {
          uid,
          workoutName: (session as any).workoutName,
          startedAt: new Date((session as any).startedAt).toISOString(),
          endedAt: new Date((session as any).endedAt).toISOString(),
          durationSeconds: (session as any).durationSeconds,
          wasCompleted: (session as any).wasCompleted,
        });

        await database.write(async () => {
          await (session as any).update((record: any) => {
            record.syncStatus = 'synced';
            record.firebaseId = docRef.id;
          });
        });

        console.log('Synced session:', session.id);
      } catch (e) {
        console.error('Failed to sync session:', session.id, e);
      }
    }
  } catch (e) {
    console.error('SyncService error:', e);
  }
}

export function startSyncListener(uid: string) {
  return NetInfo.addEventListener(state => {
    if (state.isConnected) {
      console.log('Back online — syncing pending workouts...');
      syncPendingSessions(uid);
    }
  });
}