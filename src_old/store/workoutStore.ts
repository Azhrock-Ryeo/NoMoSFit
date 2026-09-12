import { create } from 'zustand';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  targetReps: number;
  weight: number;
}

export interface SetLog {
  setNumber: number;
  achievedReps: number;
  weight: number;
  completedAt: string;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
}

interface WorkoutState {
  workoutName: string;
  exercises: Exercise[];
  exerciseLogs: ExerciseLog[];
  startedAt: string | null;
  isActive: boolean;
  setWorkoutName: (name: string) => void;
  setExercises: (exercises: Exercise[]) => void;
  startWorkout: () => void;
  logSet: (exerciseId: string, exerciseName: string, set: SetLog) => void;
  resetWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  workoutName: '',
  exercises: [],
  exerciseLogs: [],
  startedAt: null,
  isActive: false,
  setWorkoutName: (name) => set({ workoutName: name }),
  setExercises: (exercises) => set({ exercises }),
  startWorkout: () => set({ startedAt: new Date().toISOString(), isActive: true }),
  logSet: (exerciseId, exerciseName, newSet) =>
    set((state) => {
      const existing = state.exerciseLogs.find(e => e.exerciseId === exerciseId);
      if (existing) {
        return {
          exerciseLogs: state.exerciseLogs.map(e =>
            e.exerciseId === exerciseId
              ? { ...e, sets: [...e.sets, newSet] }
              : e
          ),
        };
      }
      return {
        exerciseLogs: [...state.exerciseLogs, { exerciseId, exerciseName, sets: [newSet] }],
      };
    }),
  resetWorkout: () => set({
    workoutName: '',
    exercises: [],
    exerciseLogs: [],
    startedAt: null,
    isActive: false,
  }),
}));