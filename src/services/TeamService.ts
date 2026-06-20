import { getDatabase, ref, set, onValue, off } from 'firebase/database';
import { app } from '../config/firebase';

const realtimeDb = getDatabase(app);

export interface TeamMemberStatus {
  uid: string;
  displayName: string;
  isWorkingOut: boolean;
  currentExercise: string;
  startedAt: number | null;
  lastUpdated: number | null;
}

export function updateMyStatus(
  teamId: string,
  uid: string,
  displayName: string,
  status: {
    isWorkingOut: boolean;
    currentExercise?: string;
  }
) {
  const memberRef = ref(realtimeDb, `liveTeamSessions/${teamId}/members/${uid}`);
  return set(memberRef, {
    uid,
    displayName,
    isWorkingOut: status.isWorkingOut,
    currentExercise: status.currentExercise || '',
    startedAt: status.isWorkingOut ? Date.now() : null,
    lastUpdated: Date.now(),
  });
}

export function listenToTeamMembers(
  teamId: string,
  callback: (members: TeamMemberStatus[]) => void
) {
  const teamRef = ref(realtimeDb, `liveTeamSessions/${teamId}/members`);
  onValue(teamRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const members = Object.values(data) as TeamMemberStatus[];
    callback(members);
  });
  return () => off(teamRef);
}

export function clearMyStatus(teamId: string, uid: string) {
  const memberRef = ref(realtimeDb, `liveTeamSessions/${teamId}/members/${uid}`);
  return set(memberRef, {
    uid,
    isWorkingOut: false,
    currentExercise: '',
    startedAt: null,
    lastUpdated: Date.now(),
  });
}