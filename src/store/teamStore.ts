import {
  create,
} from 'zustand';

import {
  createTeam as createTeamRecord,
  getCurrentMembership,
  getTeam,
  getTeamMembers,
  joinTeam as joinTeamRecord,
  leaveTeam as leaveTeamRecord,
} from '../services/teamService';

import type {
  Team,
  TeamMember,
} from '../types/team';

interface TeamState {
  team: Team | null;

  members: TeamMember[];

  isLoading: boolean;
  hasLoaded: boolean;

  error: string | null;

  loadTeam: () => Promise<void>;

  createTeam: (
    name: string
  ) => Promise<Team>;

  joinTeam: (
    code: string
  ) => Promise<Team>;

  leaveTeam: () => Promise<void>;

  clearError: () => void;
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

export const useTeamStore =
  create<TeamState>(
    (set, get) => ({
      team: null,

      members: [],

      isLoading: false,

      hasLoaded: false,

      error: null,

      loadTeam: async () => {
        try {
          set({
            isLoading: true,
            error: null,
          });

          const membership =
            await getCurrentMembership();

          if (!membership) {
            set({
              team: null,
              members: [],
              isLoading: false,
              hasLoaded: true,
            });

            return;
          }

          const team =
            await getTeam(
              membership.teamId
            );

          if (!team) {
            set({
              team: null,
              members: [],
              isLoading: false,
              hasLoaded: true,
              error:
                'Your team could not be found.',
            });

            return;
          }

          const members =
            await getTeamMembers(
              team.id
            );

          set({
            team,
            members,
            isLoading: false,
            hasLoaded: true,
          });
        } catch (error) {
          console.error(
            'Team load error:',
            error
          );

          set({
            isLoading: false,
            hasLoaded: true,

            error:
              getErrorMessage(
                error,
                'Unable to load team.'
              ),
          });
        }
      },

      createTeam: async (
        name
      ) => {
        try {
          set({
            isLoading: true,
            error: null,
          });

          const team =
            await createTeamRecord(
              name
            );

          const members =
            await getTeamMembers(
              team.id
            );

          set({
            team,
            members,
            isLoading: false,
            hasLoaded: true,
          });

          return team;
        } catch (error) {
          console.error(
            'Team creation error:',
            error
          );

          set({
            isLoading: false,

            error:
              getErrorMessage(
                error,
                'Unable to create team.'
              ),
          });

          throw error;
        }
      },

      joinTeam: async (
        code
      ) => {
        try {
          set({
            isLoading: true,
            error: null,
          });

          const team =
            await joinTeamRecord(
              code
            );

          const members =
            await getTeamMembers(
              team.id
            );

          set({
            team,
            members,
            isLoading: false,
            hasLoaded: true,
          });

          return team;
        } catch (error) {
          console.error(
            'Team join error:',
            error
          );

          set({
            isLoading: false,

            error:
              getErrorMessage(
                error,
                'Unable to join team.'
              ),
          });

          throw error;
        }
      },

      leaveTeam: async () => {
        const team =
          get().team;

        if (!team) {
          return;
        }

        try {
          set({
            isLoading: true,
            error: null,
          });

          await leaveTeamRecord(
            team.id
          );

          set({
            team: null,
            members: [],
            isLoading: false,
            hasLoaded: true,
          });
        } catch (error) {
          console.error(
            'Leave team error:',
            error
          );

          set({
            isLoading: false,

            error:
              getErrorMessage(
                error,
                'Unable to leave team.'
              ),
          });

          throw error;
        }
      },

      clearError: () => {
        set({
          error: null,
        });
      },
    })
  );