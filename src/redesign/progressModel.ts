import type { WorkoutSession } from '../types/history';
import { finiteNumber } from './model';

export type TrendRange = 'WEEKS' | 'MONTHS' | 'YEAR';
export type TrendMetric = 'workouts' | 'reps' | 'volume' | 'weight';
export interface TrendBucket {
  start: number; end: number; label: string; fullLabel: string; partial: boolean;
  workouts: number; reps: number; volume: number; weight: number; sets: number;
}
/** Local-calendar boundaries (rather than adding 86400000) also handle DST. */
function weekStart(time: number): Date {
  const d = new Date(time); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d;
}
export function buildTrend(sessions: WorkoutSession[], range: TrendRange, now = Date.now(), exerciseId?: string): TrendBucket[] {
  const count = range === 'WEEKS' ? 8 : range === 'MONTHS' ? 6 : 12;
  const current = range === 'WEEKS' ? weekStart(now) : new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1);
  const buckets: TrendBucket[] = Array.from({ length: count }, (_, i) => {
    const d = new Date(current); const shift = i - count + 1;
    if (range === 'WEEKS') d.setDate(d.getDate() + shift * 7); else d.setMonth(d.getMonth() + shift);
    const end = new Date(d);
    if (range === 'WEEKS') end.setDate(end.getDate() + 7); else end.setMonth(end.getMonth() + 1);
    return { start: d.getTime(), end: end.getTime(), partial: i === count - 1,
      label: d.toLocaleDateString(undefined, range === 'WEEKS' ? { month: 'short', day: 'numeric' } : { month: 'short' }),
      fullLabel: d.toLocaleDateString(undefined, range === 'WEEKS' ? { year: 'numeric', month: 'short', day: 'numeric' } : { year: 'numeric', month: 'long' }),
      workouts: 0, reps: 0, volume: 0, weight: 0, sets: 0 };
  });
  const seen = new Set<string>();
  for (const session of sessions) {
    if (seen.has(session.id) || !Number.isFinite(session.finishedAt) || session.finishedAt > now) continue;
    seen.add(session.id);
    const bucket = buckets.find(b => session.finishedAt >= b.start && session.finishedAt < b.end);
    if (!bucket) continue;
    const sets = session.completedSets.filter(s => !exerciseId || s.exerciseId === exerciseId);
    if (exerciseId && !sets.length) continue;
    bucket.workouts++;
    for (const set of sets) {
      const reps = Math.max(0, finiteNumber(set.reps)); const kg = Math.max(0, finiteNumber(set.weight));
      bucket.sets++; bucket.reps += reps; bucket.volume += reps * kg;
      // An unperformed/zero-rep set is not a successful best-weight record.
      if (reps > 0) bucket.weight = Math.max(bucket.weight, kg);
    }
  }
  return buckets;
}
export function exerciseOptions(sessions: WorkoutSession[]) {
  const options = new Map<string, string>();
  for (const s of [...sessions].sort((a, b) => b.finishedAt - a.finishedAt))
    for (const e of s.completedSets) if (!options.has(e.exerciseId)) options.set(e.exerciseId, e.exerciseName);
  // Exercise IDs, not names: two independently-created "Bench" exercises stay separate.
  return [...options].map(([id, name]) => ({ id, name }));
}
export function trendChange(buckets: TrendBucket[], metric: TrendMetric) {
  // Compare ONLY the last two completed periods, never a partial current period.
  const completed = buckets.filter(b => !b.partial);
  if (completed.length < 2) return null;
  const a = completed[completed.length - 2], b = completed[completed.length - 1];
  if (a.workouts === 0 || b.workouts === 0) return null;
  return { before: a[metric], after: b[metric], delta: b[metric] - a[metric], beforeLabel: a.fullLabel, afterLabel: b.fullLabel };
}
export function resolveStartingWeight(configured: unknown, previous: unknown): number {
  const explicit = typeof configured === 'number' && Number.isFinite(configured) && configured >= 0;
  const n = explicit ? configured : Math.max(0, finiteNumber(previous));
  return Math.round(Math.min(2000, n) * 2) / 2;
}
/** Pure row mapping. No grouping/range reduction: EVERY logged set remains visible. */
export function completedSetRows(session: WorkoutSession) {
  return session.completedSets.map((set, index) => ({
    key: `${set.id}:${index}`, exerciseId: set.exerciseId, name: set.exerciseName,
    number: set.setNumber, reps: set.reps, target: set.targetReps, kg: set.weight,
  }));
}
