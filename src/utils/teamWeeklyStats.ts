import type {
  TeamMember,
} from '../types/team';

import type {
  TeamWorkoutActivity,
} from '../types/teamActivity';

export interface TeamWeeklyMemberStats {
  userId: string;
  displayName: string;

  workouts: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  durationSeconds: number;

  latestWorkoutAt: number;
}

export interface TeamWeeklyStats {
  weekStart: number;

  totalWorkouts: number;
  activeMembers: number;

  totalSets: number;
  totalReps: number;
  totalVolume: number;
  durationSeconds: number;

  members:
    TeamWeeklyMemberStats[];
}

export interface TeamWeeklyLeaderboardEntry {
  rank: number;

  userId: string;
  displayName: string;
  email: string;
  role:
    TeamMember['role'];

  workouts: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  durationSeconds: number;

  latestWorkoutAt: number;

  isActive: boolean;
}

export function getStartOfCurrentWeek(
  timestamp = Date.now()
) {
  const now =
    new Date(timestamp);

  const day =
    now.getDay();

  /*
   * Monday = start of week.
   *
   * Sunday is treated as six days
   * after Monday.
   */
  const daysSinceMonday =
    day === 0
      ? 6
      : day - 1;

  const start =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() -
        daysSinceMonday
    );

  start.setHours(
    0,
    0,
    0,
    0
  );

  return start.getTime();
}

export function calculateTeamWeeklyStats(
  activities:
    TeamWorkoutActivity[]
): TeamWeeklyStats {
  const weekStart =
    getStartOfCurrentWeek();

  const weekly =
    activities.filter(
      (activity) =>
        activity.finishedAt >=
        weekStart
    );

  const memberMap =
    new Map<
      string,
      TeamWeeklyMemberStats
    >();

  let totalSets =
    0;

  let totalReps =
    0;

  let totalVolume =
    0;

  let durationSeconds =
    0;

  weekly.forEach(
    (activity) => {
      totalSets +=
        activity.totalSets;

      totalReps +=
        activity.totalReps;

      totalVolume +=
        activity.totalVolume;

      durationSeconds +=
        activity.durationSeconds;

      const existing =
        memberMap.get(
          activity.userId
        );

      if (existing) {
        existing.workouts +=
          1;

        existing.totalSets +=
          activity.totalSets;

        existing.totalReps +=
          activity.totalReps;

        existing.totalVolume +=
          activity.totalVolume;

        existing.durationSeconds +=
          activity.durationSeconds;

        if (
          activity.finishedAt >
          existing.latestWorkoutAt
        ) {
          existing.latestWorkoutAt =
            activity.finishedAt;

          existing.displayName =
            activity.displayName;
        }

        return;
      }

      memberMap.set(
        activity.userId,
        {
          userId:
            activity.userId,

          displayName:
            activity.displayName,

          workouts:
            1,

          totalSets:
            activity.totalSets,

          totalReps:
            activity.totalReps,

          totalVolume:
            activity.totalVolume,

          durationSeconds:
            activity.durationSeconds,

          latestWorkoutAt:
            activity.finishedAt,
        }
      );
    }
  );

  const members =
    Array.from(
      memberMap.values()
    );

  return {
    weekStart,

    totalWorkouts:
      weekly.length,

    activeMembers:
      members.length,

    totalSets,

    totalReps,

    totalVolume,

    durationSeconds,

    members,
  };
}

/*
 * ====================================
 * WEEKLY LEADERBOARD
 * ====================================
 *
 * Every Team member appears here.
 *
 * Ranking priority:
 *
 * 1. Workouts
 * 2. Total volume
 * 3. Total sets
 * 4. Total reps
 * 5. Most recent workout
 *
 * Members with no workouts this week
 * remain visible at the bottom.
 */

export function buildTeamWeeklyLeaderboard(
  teamMembers:
    TeamMember[],

  weeklyMembers:
    TeamWeeklyMemberStats[]
): TeamWeeklyLeaderboardEntry[] {
  const statsByUser =
    new Map(
      weeklyMembers.map(
        (member) => [
          member.userId,
          member,
        ]
      )
    );

  const entries =
    teamMembers.map(
      (
        teamMember
      ): Omit<
        TeamWeeklyLeaderboardEntry,
        'rank'
      > => {
        const stats =
          statsByUser.get(
            teamMember.uid
          );

        return {
          userId:
            teamMember.uid,

          displayName:
            stats?.displayName?.trim() ||
            teamMember.displayName ||
            'Athlete',

          email:
            teamMember.email,

          role:
            teamMember.role,

          workouts:
            stats?.workouts ??
            0,

          totalSets:
            stats?.totalSets ??
            0,

          totalReps:
            stats?.totalReps ??
            0,

          totalVolume:
            stats?.totalVolume ??
            0,

          durationSeconds:
            stats?.durationSeconds ??
            0,

          latestWorkoutAt:
            stats?.latestWorkoutAt ??
            0,

          isActive:
            (
              stats?.workouts ??
              0
            ) > 0,
        };
      }
    );

  entries.sort(
    (
      a,
      b
    ) => {
      if (
        b.workouts !==
        a.workouts
      ) {
        return (
          b.workouts -
          a.workouts
        );
      }

      if (
        b.totalVolume !==
        a.totalVolume
      ) {
        return (
          b.totalVolume -
          a.totalVolume
        );
      }

      if (
        b.totalSets !==
        a.totalSets
      ) {
        return (
          b.totalSets -
          a.totalSets
        );
      }

      if (
        b.totalReps !==
        a.totalReps
      ) {
        return (
          b.totalReps -
          a.totalReps
        );
      }

      if (
        b.latestWorkoutAt !==
        a.latestWorkoutAt
      ) {
        return (
          b.latestWorkoutAt -
          a.latestWorkoutAt
        );
      }

      return a.displayName.localeCompare(
        b.displayName
      );
    }
  );

  return entries.map(
    (
      entry,
      index
    ) => ({
      ...entry,

      rank:
        index + 1,
    })
  );
}