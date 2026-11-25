import { collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query, startAfter, where,
  type DocumentData, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import type { Team, TeamMember } from '../../types/team';
import type { TeamWorkoutActivity } from '../../types/teamActivity';
import { getStartOfCurrentWeek } from '../../utils/teamWeeklyStats';
import { activityFromData, HISTORY_PAGE_SIZE, nonnegative, scopeKey, summarizeWeek, taggedError, validId, withDeadline, type HistoryScope, type WeeklySummary } from './model';

export type TeamOverview = { team: Team | null; members: TeamMember[]; checkedAt: number };
export type HistoryCursor = { scope: string; last: QueryDocumentSnapshot<DocumentData> };
export type HistoryPage = { items: TeamWorkoutActivity[]; cursor: HistoryCursor | null; hasMore: boolean };

// Pending requests only, not an unbounded history cache. Rapid Retry taps reuse a live request.
const pending = new Map<string, Promise<unknown>>();
export function assertViewer(viewerUid: string) {
  if (!viewerUid || auth.currentUser?.uid !== viewerUid) throw taggedError('team/session-changed', 'The signed-in account changed.');
}
function read<T>(viewerUid: string, key: string, work: () => Promise<T>): Promise<T> {
  assertViewer(viewerUid);
  const fullKey = JSON.stringify([viewerUid, key]);
  let request = pending.get(fullKey) as Promise<T> | undefined;
  if (!request) {
    request = Promise.resolve().then(work).then(value => { assertViewer(viewerUid); return value; });
    pending.set(fullKey, request);
    const cleanup = () => { if (pending.get(fullKey) === request) pending.delete(fullKey); };
    void request.then(cleanup, cleanup);
  }
  return withDeadline(request);
}
async function viewerTeam(viewerUid: string): Promise<string | null> {
  assertViewer(viewerUid);
  const result = await getDocFromServer(doc(db, 'teamMemberships', viewerUid));
  assertViewer(viewerUid);
  if (!result.exists()) return null;
  const id: unknown = result.data()?.teamId;
  if (typeof id !== 'string' || !validId(id)) throw taggedError('team/access-changed', 'Invalid Team membership.');
  return id;
}
async function requireTeam(viewerUid: string, teamId: string) {
  if (!validId(teamId) || await viewerTeam(viewerUid) !== teamId) throw taggedError('team/access-changed', 'Team membership changed.');
}

export function fetchOverview(viewerUid: string): Promise<TeamOverview> {
  return read(viewerUid, 'overview', async () => {
    const teamId = await viewerTeam(viewerUid);
    if (!teamId) return { team: null, members: [], checkedAt: Date.now() };
    const [teamDoc, roster] = await Promise.all([
      getDocFromServer(doc(db, 'teams', teamId)),
      getDocsFromServer(collection(db, 'teams', teamId, 'members')),
    ]);
    assertViewer(viewerUid);
    if (!teamDoc.exists()) throw taggedError('team/access-changed', 'Team no longer exists.');
    const value = teamDoc.data();
    if (!value) throw taggedError('team/access-changed', 'Team no longer exists.');
    const team: Team = {
      id: teamId, name: typeof value.name === 'string' ? value.name : 'Team',
      joinCode: typeof value.joinCode === 'string' ? value.joinCode : teamId,
      ownerId: typeof value.ownerId === 'string' ? value.ownerId : '',
      createdAt: nonnegative(value.createdAt, true), updatedAt: nonnegative(value.updatedAt, true),
    };
    const members: TeamMember[] = roster.docs.map(member => {
      const data = member.data();
      return { uid: member.id, displayName: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : 'Athlete',
        email: '', // Member email is not displayed or copied into the new overview state.
        role: data.role === 'owner' ? 'owner' : 'member', joinedAt: nonnegative(data.joinedAt, true) };
    });
    if (!members.some(member => member.uid === viewerUid)) throw taggedError('team/access-changed', 'You are no longer a Team member.');
    return { team, members, checkedAt: Date.now() };
  });
}
/** Aggregate current-week totals only; no all-time activity feed is loaded on Team. */
export function fetchWeek(viewerUid: string, teamId: string): Promise<WeeklySummary> {
  const weekStart = getStartOfCurrentWeek();
  return read(viewerUid, JSON.stringify(['week', teamId, weekStart]), async () => {
    await requireTeam(viewerUid, teamId);
    const result = await getDocsFromServer(query(collection(db, 'teams', teamId, 'activity'),
      where('finishedAt', '>=', weekStart), orderBy('finishedAt', 'desc')));
    assertViewer(viewerUid);
    return summarizeWeek(result.docs.map(item => activityFromData(item.id, teamId, item.data())));
  });
}
/** Read only this member's shared entries. A snapshot cursor handles equal timestamps. */
export function fetchMemberPage(scope: HistoryScope, cursor: HistoryCursor | null = null): Promise<HistoryPage> {
  if (!validId(scope.teamId) || !validId(scope.memberUid)) return Promise.reject(taggedError('team/access-changed', 'Invalid Team history request.'));
  const key = scopeKey(scope);
  if (cursor && (cursor.scope !== key || cursor.last.ref.parent.path !== `teams/${scope.teamId}/activity` || cursor.last.data().userId !== scope.memberUid)) {
    return Promise.reject(taggedError('team/access-changed', 'History cursor belongs to another member or team.'));
  }
  return read(scope.viewerUid, JSON.stringify(['history', key, cursor?.last.id ?? 'first']), async () => {
    await requireTeam(scope.viewerUid, scope.teamId);
    const member = await getDocFromServer(doc(db, 'teams', scope.teamId, 'members', scope.memberUid));
    assertViewer(scope.viewerUid);
    if (!member.exists()) throw taggedError('team/member-left', 'Member is no longer in this team.');
    const constraints: QueryConstraint[] = [where('userId', '==', scope.memberUid), orderBy('finishedAt', 'desc')];
    if (cursor) constraints.push(startAfter(cursor.last));
    constraints.push(limit(HISTORY_PAGE_SIZE));
    const result = await getDocsFromServer(query(collection(db, 'teams', scope.teamId, 'activity'), ...constraints));
    assertViewer(scope.viewerUid);
    const items = result.docs.map(item => activityFromData(item.id, scope.teamId, item.data()))
      .filter(item => item.userId === scope.memberUid);
    const last = result.docs[result.docs.length - 1];
    return { items, cursor: last ? { scope: key, last } : null, hasMore: result.size === HISTORY_PAGE_SIZE };
  });
}
