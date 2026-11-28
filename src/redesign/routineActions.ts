import { AppAlert as Alert } from './feedback';
import { auth } from '../config/firebase';
import { useProgramStore } from '../store/programStore';
import { useWorkoutStore } from '../store/workoutStore';
import type { WorkoutProgram } from '../types/program';
const pending = new Set<string>();
/** Deletes ONLY a reusable program. Never touches completed History or Team summaries. */
export function confirmRemoveRoutine(program: WorkoutProgram, onRemoved?: () => void): void {
  const owner = auth.currentUser?.uid;
  if (!owner || useProgramStore.getState().ownerUid !== owner) {
    Alert.alert('Sign in again', 'Your account changed. The workout was not removed.'); return;
  }
  if (useWorkoutStore.getState().workout?.programId === program.id) {
    Alert.alert('Workout in progress', 'Finish or discard this active workout before removing its routine.'); return;
  }
  const key = `${owner}:${program.id}`;
  if (pending.has(key)) return;
  pending.add(key);
  let deleting = false;
  const release = () => { pending.delete(key); };
  Alert.alert('Remove this workout routine?',
    `Remove "${program.name}" from Quick Start and Programs?\n\nOnly the reusable routine will be deleted. ALL completed sessions, reps, weights, progress graphs and shared Team history will be kept. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel', onPress: release },
      { text: 'Remove routine', style: 'destructive', onPress: () => { if(deleting)return; deleting = true; void (async () => {
        try {
          if (auth.currentUser?.uid !== owner || useProgramStore.getState().ownerUid !== owner) throw new Error('Account changed. Removal cancelled.');
          if (useWorkoutStore.getState().workout?.programId === program.id) throw new Error('This routine is in use. Finish the active workout first.');
          await useProgramStore.getState().removeProgram(program.id);
          if (auth.currentUser?.uid === owner) onRemoved?.();
          // Metadata is intentionally kept. Deleting a routine must not delete History.
        } catch (err) {
          if (auth.currentUser?.uid === owner) Alert.alert('Unable to remove routine', err instanceof Error ? err.message : 'Please try again.');
        } finally { release(); }
      })(); } },
    ], { cancelable: true, onDismiss: () => { if(!deleting) release(); } });
}
