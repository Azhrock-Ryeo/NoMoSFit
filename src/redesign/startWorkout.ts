import { create } from 'zustand';
import { Alert } from 'react-native';
import { auth } from '../config/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWorkoutStore } from '../store/workoutStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import type { WorkoutProgram } from '../types/program';
import type { RootRoutes } from './routes';
import { normalizeExercises, normalizeSettings, type ProgramSettings } from './model';
import { settingsFor, useProgramSettings } from './preferences';
import { resolveStartingWeight } from './progressModel';

/** Per-session copy: editing a program later must not change a running workout. */
export const useWorkoutPresentation=create<{workoutId:string|null;settings:ProgramSettings;set:(id:string|null,settings?:ProgramSettings)=>void}>(set=>({
  workoutId:null,settings:normalizeSettings(undefined),set:(workoutId,settings)=>set({workoutId,settings:normalizeSettings(settings)}),
}));
export function startProgram(program:WorkoutProgram,navigation:NativeStackNavigationProp<RootRoutes>) {
  const active=useWorkoutStore.getState().workout;
  if(active){
    Alert.alert('Workout already started','Resume or finish your current workout before starting another.',[
      {text:'Cancel',style:'cancel'}, {text:'Resume',onPress:()=>navigation.navigate('Workout',{programId:active.programId})},
    ]);return;
  }
  if(useProgramSettings.getState().ownerUid!==auth.currentUser?.uid||!useProgramSettings.getState().loaded||useProgramSettings.getState().error){Alert.alert('Training settings','Wait for settings to load, or retry loading them before starting.');return;}
  if(useWorkoutHistoryStore.getState().ownerUid!==auth.currentUser?.uid||!useWorkoutHistoryStore.getState().hasLoaded||useWorkoutHistoryStore.getState().isLoading){Alert.alert('Workout history','History is still loading. Try starting again when loading finishes.');return;}
  if(!program.exercises.length){Alert.alert('Empty program','Add an exercise first.');return;}
  const settings=settingsFor(program.id);
  const latest=useWorkoutHistoryStore.getState().getLatestForProgram(program.id);
  useWorkoutStore.getState().startWorkout({...program,exercises:normalizeExercises(program.exercises,settings.mode)},latest);
  const next=useWorkoutStore.getState().workout;
  if(!next)return;
  useWorkoutStore.setState({workout:{...next,exercises:next.exercises.map(ex=>{
    // A configured starting weight (including explicit 0 kg) wins over old History.
    return {...ex,workingWeight:resolveStartingWeight(settings.initialWeights[ex.id],ex.workingWeight)};
  })}});
  useWorkoutPresentation.getState().set(next.id,settings);
  navigation.navigate('Workout',{programId:program.id});
}

/** Called by Complete Set. Uses a snapshot tied to THIS workout, never another program. */
export function beginProgramRest(): void {
  const store = useWorkoutStore.getState();
  const before = store.workout;
  if (!before || before.status !== 'active' || before.rest) return;
  store.beginRest();
  const after = useWorkoutStore.getState().workout;
  if (!after?.rest || after.id !== before.id) return;
  const presentation = useWorkoutPresentation.getState();
  const restSeconds = presentation.workoutId === after.id
    ? normalizeSettings(presentation.settings).restSeconds
    : 90; // Existing workouts with no redesign metadata retain their old rest.
  useWorkoutStore.setState({workout:{...after,rest:{...after.rest,durationSeconds:restSeconds}}});
}
