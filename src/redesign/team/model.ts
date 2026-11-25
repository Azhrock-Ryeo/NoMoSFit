import type { TeamMember } from '../../types/team';
import type { TeamWorkoutActivity } from '../../types/teamActivity';

export const HISTORY_PAGE_SIZE = 20;
export const REQUEST_TIMEOUT_MS = 20000;
export type HistoryScope = { viewerUid: string; teamId: string; memberUid: string };
export type Problem = { title: string; message: string; code: string; indexUrl?: string; clearData: boolean };

export function scopeKey(scope: HistoryScope): string {
  return JSON.stringify([scope.viewerUid, scope.teamId, scope.memberUid]);
}
export function validId(id: string): boolean {
  return typeof id === 'string' && id.trim().length > 0 && !id.includes('/');
}
export function nonnegative(value: unknown, integer = false): number {
  const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return integer ? Math.floor(n) : n;
}
function timestamp(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    try { return nonnegative(value.toMillis(), true); } catch { return 0; }
  }
  return nonnegative(value, true);
}
function label(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
/** Only already-shared Team totals are read. Never fabricate individual exercise logs. */
export function activityFromData(id: string, teamId: string, data: Record<string, unknown>): TeamWorkoutActivity {
  return {
    id, teamId, userId: label(data.userId, ''), displayName: label(data.displayName, 'Athlete'),
    sessionId: label(data.sessionId, id), programId: label(data.programId, ''),
    programName: label(data.programName, 'Workout'), finishedAt: timestamp(data.finishedAt),
    durationSeconds: nonnegative(data.durationSeconds, true), totalSets: nonnegative(data.totalSets, true),
    totalReps: nonnegative(data.totalReps, true), totalVolume: nonnegative(data.totalVolume),
  };
}
/** Cursor pages can overlap if a document changes. Deduplicate without mutating inputs. */
export function mergeHistory(current: TeamWorkoutActivity[], next: TeamWorkoutActivity[], scope: HistoryScope): TeamWorkoutActivity[] {
  const map = new Map<string, TeamWorkoutActivity>();
  for (const item of [...current, ...next]) {
    if (item.teamId === scope.teamId && item.userId === scope.memberUid) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => b.finishedAt - a.finishedAt || b.id.localeCompare(a.id));
}
export function summarizeWeek(items: TeamWorkoutActivity[]) {
  const unique = new Map(items.map(item => [item.id, item]));
  const members: Record<string, { workouts: number; sets: number; reps: number; volume: number; seconds: number }> = Object.create(null);
  const totals = { workouts: 0, sets: 0, reps: 0, volume: 0, seconds: 0, activeMembers: 0, members };
  for (const item of unique.values()) {
    const row = members[item.userId] ??= { workouts: 0, sets: 0, reps: 0, volume: 0, seconds: 0 };
    totals.workouts++; row.workouts++;
    const values = { sets: nonnegative(item.totalSets, true), reps: nonnegative(item.totalReps, true), volume: nonnegative(item.totalVolume), seconds: nonnegative(item.durationSeconds, true) };
    for (const key of ['sets', 'reps', 'volume', 'seconds'] as const) { totals[key] += values[key]; row[key] += values[key]; }
  }
  totals.activeMembers = Object.keys(members).length;
  return totals;
}
export type WeeklySummary = ReturnType<typeof summarizeWeek>;
export function orderMembers(members: TeamMember[], weekly: WeeklySummary | null): TeamMember[] {
  return [...members].sort((a, b) => {
    const av = weekly?.members[a.uid], bv = weekly?.members[b.uid];
    return (bv?.workouts ?? 0) - (av?.workouts ?? 0) || (bv?.volume ?? 0) - (av?.volume ?? 0)
      || a.displayName.localeCompare(b.displayName) || a.uid.localeCompare(b.uid);
  });
}
export function duration(seconds: number): string {
  const s = nonnegative(seconds, true), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
export function workoutDate(value: number): string {
  const date = new Date(value);
  return value > 0 && Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Date unavailable';
}
export function quantity(value: number): string {
  return nonnegative(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}
export function problemFrom(error: unknown): Problem {
  const value = error as { code?: unknown; message?: unknown } | null;
  const code = typeof value?.code === 'string' ? value.code.replace(/^firestore\//, '') : 'unknown';
  const message = typeof value?.message === 'string' ? value.message : '';
  if (code === 'permission-denied' || code === 'team/access-changed') return {
    code, clearData: true, title: 'Team access changed',
    message: 'Your account may no longer belong to this team, or its sharing rules denied access. Return to Team and refresh. No database rules were changed.',
  };
  if (code === 'unauthenticated' || code === 'team/session-changed') return {
    code, clearData: true, title: 'Sign-in needs refreshing', message: 'Your signed-in account changed or expired. Return to the app and sign in again.',
  };
  if (code === 'team/member-left') return {
    code, clearData: true, title: 'Member no longer available', message: 'This member is no longer listed in this team. Return to Team and refresh the member list.',
  };
  if (code === 'failed-precondition' && /index/i.test(message)) {
    const found = message.match(/https:\/\/console\.firebase\.google\.com\/[^\s<>"']+/)?.[0];
    return { code, clearData: false, title: 'History index needed', indexUrl: found,
      message: 'The app owner needs one Firestore index: activity collection, userId ascending, finishedAt descending. Shared workouts have not been deleted. See FIRESTORE-INDEX.md in this update.' };
  }
  if (['unavailable', 'deadline-exceeded', 'team/timeout', 'network-request-failed'].includes(code)) return {
    code, clearData: false, title: 'Connection interrupted', message: 'Shared Team history needs an internet connection. Check the phone connection, then tap Retry. Previously loaded entries may be out of date.',
  };
  if (code === 'resource-exhausted') return {
    code, clearData: false, title: 'Team service is busy', message: 'The database is temporarily limiting requests. Try again later; your workouts were not deleted.',
  };
  return { code, clearData: false, title: 'Unable to load Team', message: 'Please try again. If this continues, share the error code shown below; do not change database permissions.' };
}
export function taggedError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
/** UI timeout only. Firebase has no getDocs cancellation API; late results are ignored. */
export function withDeadline<T>(promise: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(taggedError('team/timeout', 'Team request timed out.')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
/** Shared by hooks: a newer request/unmount invalidates every older completion. */
export function createRequestGate() {
  let revision = 0;
  return { begin: () => ++revision, current: (id: number) => id === revision, invalidate: () => { revision++; } };
}
