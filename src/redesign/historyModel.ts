import type { WorkoutSession } from '../types/history';
import { finiteNumber, groupSessions } from './model';
export function sessionStats(session: WorkoutSession) {
  const sets = session.completedSets;
  return {
    sets: sets.length,
    exercises: new Set(sets.map(s => s.exerciseId)).size,
    reps: sets.reduce((n, s) => n + Math.max(0, finiteNumber(s.reps)), 0),
    volume: sets.reduce((n, s) => n + Math.max(0, finiteNumber(s.reps)) * Math.max(0, finiteNumber(s.weight)), 0),
    seconds: Math.max(0, finiteNumber(session.durationSeconds)),
  };
}
/** Key by persistent program ID. Two programs with the same title stay separate. */
export function historyGroups(sessions: WorkoutSession[], search = '') {
  const term = search.trim().toLocaleLowerCase();
  return groupSessions(sessions).filter(group => group.name.toLocaleLowerCase().includes(term)).map(group => ({
    ...group,
    latest: group.sessions[0],
    latestStats: sessionStats(group.sessions[0]),
    totalSets: group.sessions.reduce((n, session) => n + sessionStats(session).sets, 0),
  }));
}
export function historyTotals(sessions: WorkoutSession[]) {
  return { workouts: sessions.length,
    sets: sessions.reduce((n, session) => n + sessionStats(session).sets, 0),
    seconds: sessions.reduce((n, session) => n + sessionStats(session).seconds, 0) };
}
export function historyDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Date unavailable';
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
export function historyTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function compactNumber(value: number): string {
  const n = Math.max(0, finiteNumber(value));
  return n >= 10000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n * 10) / 10);
}
