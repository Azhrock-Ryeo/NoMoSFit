import type { WorkoutProgram, ProgramExercise, WorkoutCategory } from '../types/program';
import type { WorkoutSession } from '../types/history';
import type { CompletedWorkoutSet } from '../types/workout';

export type TrainingMode = 'STRENGTH' | 'HYPERTROPHY' | 'ENDURANCE' | 'CUSTOM';
export type SwipeChoice = 'left' | 'right' | 'up' | null;
export interface ProgramSettings {
  mode: TrainingMode;
  restSeconds: number;
  initialWeights: Record<string, number>;
}
export const PRESETS = {
  STRENGTH: { label: 'Strength', range: '1–6', target: 6, defaultRestSeconds: 300 },
  HYPERTROPHY: { label: 'Hypertrophy', range: '6–12', target: 12, defaultRestSeconds: 120 },
  ENDURANCE: { label: 'Endurance', range: '15+', target: 15, defaultRestSeconds: 30 },
};
export const DAYS: Array<{ name: string; category: WorkoutCategory }> = [
  { name: 'PUSH DAY', category: 'PUSH' }, { name: 'PULL DAY', category: 'PULL' },
  { name: 'LOWER BODY DAY', category: 'LEGS' }, { name: 'ARMS DAY', category: 'PULL' },
  { name: 'LEG DAY', category: 'LEGS' }, { name: 'ABS DAY', category: 'CORE' },
  { name: 'FULL BODY', category: 'FULL BODY' },
];
export function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
export function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
export function normalizeSettings(value: unknown): ProgramSettings {
  const data = (value && typeof value === 'object' ? value : {}) as Partial<ProgramSettings>;
  const mode: TrainingMode = data.mode && ['STRENGTH', 'HYPERTROPHY', 'ENDURANCE', 'CUSTOM'].includes(data.mode) ? data.mode : 'CUSTOM';
  let restSeconds = Math.round(clamp(finiteNumber(data.restSeconds, 90), 1, 3600));
  if (mode !== 'CUSTOM') {
    // A preset is deterministic. Existing CUSTOM settings are never converted.
    restSeconds = PRESETS[mode].defaultRestSeconds;
  }
  const initialWeights: Record<string, number> = {};
  if (data.initialWeights && typeof data.initialWeights === 'object') {
    Object.entries(data.initialWeights).forEach(([id, weight]) => {
      initialWeights[id] = Math.round(clamp(finiteNumber(weight), 0, 2000) * 2) / 2;
    });
  }
  return { mode, restSeconds, initialWeights };
}
export function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(finiteNumber(value)));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
export function repLabel(mode: TrainingMode, target: number) { return mode === 'CUSTOM' ? `${target}` : PRESETS[mode].range; }
export function normalizeExercises(exercises: ProgramExercise[], mode: TrainingMode): ProgramExercise[] {
  return exercises.map(ex => ({ ...ex, name: ex.name.trim(), sets: Math.round(clamp(finiteNumber(ex.sets, 3), 1, 20)),
    targetReps: mode === 'CUSTOM' ? Math.round(clamp(finiteNumber(ex.targetReps, 8), 1, 100)) : PRESETS[mode].target,
  })).filter(ex => ex.name.length > 0);
}
export function swipeChoice(dx: number, dy: number): SwipeChoice {
  if (dy <= -36 && Math.abs(dy) > Math.abs(dx)) return 'up';
  if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return null;
}
export function summarizeSets(sets: CompletedWorkoutSet[]) {
  const rows = new Map<string, { id: string; name: string; sets: number; reps: number[]; weights: number[]; volume: number }>();
  for (const set of sets) {
    const row = rows.get(set.exerciseId) ?? { id: set.exerciseId, name: set.exerciseName, sets: 0, reps: [], weights: [], volume: 0 };
    row.sets++; row.reps.push(set.reps); row.weights.push(set.weight); row.volume += set.reps * set.weight;
    rows.set(set.exerciseId, row);
  }
  return [...rows.values()];
}
export function span(values: number[], suffix = '') {
  if (!values.length) return '—';
  const lo = Math.min(...values), hi = Math.max(...values);
  return `${lo === hi ? lo : `${lo}–${hi}`}${suffix}`;
}
export function previousSession(sessions: WorkoutSession[], current: WorkoutSession) {
  return [...sessions].filter(s => s.programId === current.programId && s.id !== current.id && s.finishedAt < current.finishedAt)
    .sort((a,b) => b.finishedAt - a.finishedAt)[0];
}
export function groupSessions(sessions: WorkoutSession[]) {
  const groups = new Map<string, { id: string; name: string; sessions: WorkoutSession[] }>();
  for (const s of [...sessions].sort((a,b) => b.finishedAt - a.finishedAt)) {
    const g = groups.get(s.programId) ?? { id: s.programId, name: s.programName, sessions: [] };
    g.sessions.push(s); groups.set(s.programId, g);
  }
  return [...groups.values()];
}
export function createId(prefix = 'program') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }
export function programGoalRows(program: WorkoutProgram, settings: ProgramSettings) {
  return program.exercises.map(e => ({ id: e.id, name: e.name, sets: `${e.sets}x`, reps: `${repLabel(settings.mode,e.targetReps)}x`, weight: `${settings.initialWeights[e.id] ?? 0}kg` }));
}
