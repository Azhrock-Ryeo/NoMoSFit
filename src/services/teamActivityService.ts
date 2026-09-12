import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

import {
  auth,
  db,
} from '../config/firebase';

import {
  getCurrentMembership,
} from './teamService';

import {
  getStartOfCurrentWeek,
} from '../utils/teamWeeklyStats';

import type {
  WorkoutSession,
} from '../types/history';

import type {
  TeamWorkoutActivity,
} from '../types/teamActivity';

function getDisplayName() {
  const user =
    auth.currentUser;

  if (!user) {
    return 'Athlete';
  }

  if (
    user.displayName?.trim()
  ) {
    return user.displayName.trim();
  }

  if (user.email) {
    return user.email
      .split('@')[0]
      .replace(
        /[._-]/g,
        ' '
      );
  }

  return 'Athlete';
}

function mapActivity(
  activityDoc: {
    id: string;
    data: () => {
      [key: string]:
        unknown;
    };
  },
  teamId: string
): TeamWorkoutActivity {
  const data =
    activityDoc.data();

  return {
    id:
      activityDoc.id,

    teamId:
      String(
        data.teamId ??
          teamId
      ),

    userId:
      String(
        data.userId ??
          ''
      ),

    displayName:
      String(
        data.displayName ??
          'Athlete'
      ),

    sessionId:
      String(
        data.sessionId ??
          activityDoc.id
      ),

    programId:
      String(
        data.programId ??
          ''
      ),

    programName:
      String(
        data.programName ??
          'Workout'
      ),

    finishedAt:
      Number(
        data.finishedAt ??
          0
      ),

    durationSeconds:
      Number(
        data.durationSeconds ??
          0
      ),

    totalSets:
      Number(
        data.totalSets ??
          0
      ),

    totalReps:
      Number(
        data.totalReps ??
          0
      ),

    totalVolume:
      Number(
        data.totalVolume ??
          0
      ),
  };
}

/*
 * ====================================
 * PUBLISH COMPLETED WORKOUT
 * ====================================
 */

export async function publishTeamWorkoutActivity(
  session: WorkoutSession
): Promise<
  TeamWorkoutActivity |
  null
> {
  const user =
    auth.currentUser;

  if (!user) {
    return null;
  }

  const membership =
    await getCurrentMembership();

  /*
   * Not being in a Team is valid.
   */
  if (!membership) {
    return null;
  }

  const totalReps =
    session.completedSets.reduce(
      (
        total,
        set
      ) =>
        total +
        set.reps,
      0
    );

  const totalVolume =
    session.completedSets.reduce(
      (
        total,
        set
      ) =>
        total +
        set.reps *
          set.weight,
      0
    );

  const activity:
    TeamWorkoutActivity = {
    id:
      session.id,

    teamId:
      membership.teamId,

    userId:
      user.uid,

    displayName:
      getDisplayName(),

    sessionId:
      session.id,

    programId:
      session.programId,

    programName:
      session.programName,

    finishedAt:
      session.finishedAt,

    durationSeconds:
      session.durationSeconds,

    totalSets:
      session.completedSets
        .length,

    totalReps,

    totalVolume,
  };

  /*
   * Session ID = activity document ID.
   *
   * Retrying the same publish will not
   * create duplicate feed entries.
   */
  await setDoc(
    doc(
      db,
      'teams',
      membership.teamId,
      'activity',
      session.id
    ),
    activity
  );

  return activity;
}

/*
 * ====================================
 * RECENT TEAM ACTIVITY
 * ====================================
 */

export async function getTeamWorkoutActivity(
  teamId: string
): Promise<
  TeamWorkoutActivity[]
> {
  const activityQuery =
    query(
      collection(
        db,
        'teams',
        teamId,
        'activity'
      ),

      orderBy(
        'finishedAt',
        'desc'
      ),

      limit(25)
    );

  const snapshot =
    await getDocs(
      activityQuery
    );

  return snapshot.docs.map(
    (activityDoc) =>
      mapActivity(
        activityDoc,
        teamId
      )
  );
}

/*
 * ====================================
 * CURRENT WEEK ACTIVITY
 * ====================================
 *
 * Separate query so Team stats don't
 * depend on the 25-item recent feed
 * limit.
 */

export async function getTeamWeeklyWorkoutActivity(
  teamId: string
): Promise<
  TeamWorkoutActivity[]
> {
  const weekStart =
    getStartOfCurrentWeek();

  const weeklyQuery =
    query(
      collection(
        db,
        'teams',
        teamId,
        'activity'
      ),

      where(
        'finishedAt',
        '>=',
        weekStart
      ),

      orderBy(
        'finishedAt',
        'desc'
      )
    );

  const snapshot =
    await getDocs(
      weeklyQuery
    );

  return snapshot.docs.map(
    (activityDoc) =>
      mapActivity(
        activityDoc,
        teamId
      )
  );
}