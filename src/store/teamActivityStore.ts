import {
  create,
} from 'zustand';

import {
  getTeamWeeklyWorkoutActivity,
  getTeamWorkoutActivity,
} from '../services/teamActivityService';

import type {
  TeamWorkoutActivity,
} from '../types/teamActivity';

interface TeamActivityState {
  activities:
    TeamWorkoutActivity[];

  weeklyActivities:
    TeamWorkoutActivity[];

  isLoading:
    boolean;

  error:
    string | null;

  loadActivity:
    (
      teamId: string
    ) => Promise<void>;

  clear:
    () => void;
}

export const useTeamActivityStore =
  create<TeamActivityState>(
    (set) => ({
      activities: [],

      weeklyActivities: [],

      isLoading: false,

      error: null,

      /*
       * Load recent feed and complete
       * current-week activity together.
       */
      loadActivity:
        async (
          teamId
        ) => {
          try {
            set({
              isLoading: true,
              error: null,
            });

            const [
              activities,
              weeklyActivities,
            ] =
              await Promise.all([
                getTeamWorkoutActivity(
                  teamId
                ),

                getTeamWeeklyWorkoutActivity(
                  teamId
                ),
              ]);

            set({
              activities,
              weeklyActivities,

              isLoading: false,
              error: null,
            });
          } catch (error) {
            console.error(
              'Team activity load error:',
              error
            );

            set({
              activities: [],
              weeklyActivities: [],

              isLoading: false,

              error:
                'Unable to load team activity.',
            });
          }
        },

      clear:
        () => {
          set({
            activities: [],
            weeklyActivities: [],

            isLoading: false,
            error: null,
          });
        },
    })
  );