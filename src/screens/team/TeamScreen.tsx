import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  useAuthStore,
} from '../../store/authStore';

import {
  useTeamStore,
} from '../../store/teamStore';

import {
  useTeamActivityStore,
} from '../../store/teamActivityStore';

import {
  buildTeamWeeklyLeaderboard,
  calculateTeamWeeklyStats,
} from '../../utils/teamWeeklyStats';

type SetupMode =
  | 'none'
  | 'create'
  | 'join';

function formatDuration(
  seconds: number
) {
  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (
        seconds % 3600
      ) / 60
    );

  const remaining =
    seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(
        2,
        '0'
      )}:${remaining
      .toString()
      .padStart(
        2,
        '0'
      )}`;
  }

  return `${minutes}:${remaining
    .toString()
    .padStart(
      2,
      '0'
    )}`;
}

function formatActivityDate(
  timestamp: number
) {
  const date =
    new Date(timestamp);

  const now =
    new Date();

  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  const yesterday =
    new Date(today);

  yesterday.setDate(
    yesterday.getDate() -
      1
  );

  const activityDay =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  if (
    activityDay.getTime() ===
    today.getTime()
  ) {
    return 'Today';
  }

  if (
    activityDay.getTime() ===
    yesterday.getTime()
  ) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
    }
  );
}

function formatNumber(
  value: number
) {
  return Math.round(
    value
  ).toLocaleString();
}

function getRankIcon(
  rank: number
):
  keyof typeof Ionicons.glyphMap {
  if (rank === 1) {
    return 'trophy';
  }

  if (rank === 2) {
    return 'medal';
  }

  if (rank === 3) {
    return 'medal-outline';
  }

  return 'fitness-outline';
}

function getRankColor(
  rank: number
) {
  if (rank === 1) {
    return '#FACC15';
  }

  if (rank === 2) {
    return '#D4D4D8';
  }

  if (rank === 3) {
    return '#FB923C';
  }

  return '#71717A';
}

export default function TeamScreen() {
  const user =
    useAuthStore(
      (state) =>
        state.user
    );

  const team =
    useTeamStore(
      (state) =>
        state.team
    );

  const members =
    useTeamStore(
      (state) =>
        state.members
    );

  const isLoading =
    useTeamStore(
      (state) =>
        state.isLoading
    );

  const hasLoaded =
    useTeamStore(
      (state) =>
        state.hasLoaded
    );

  const error =
    useTeamStore(
      (state) =>
        state.error
    );

  const loadTeam =
    useTeamStore(
      (state) =>
        state.loadTeam
    );

  const createTeam =
    useTeamStore(
      (state) =>
        state.createTeam
    );

  const joinTeam =
    useTeamStore(
      (state) =>
        state.joinTeam
    );

  const leaveTeam =
    useTeamStore(
      (state) =>
        state.leaveTeam
    );

  const clearError =
    useTeamStore(
      (state) =>
        state.clearError
    );

  const activities =
    useTeamActivityStore(
      (state) =>
        state.activities
    );

  const weeklyActivities =
    useTeamActivityStore(
      (state) =>
        state.weeklyActivities
    );

  const activityLoading =
    useTeamActivityStore(
      (state) =>
        state.isLoading
    );

  const activityError =
    useTeamActivityStore(
      (state) =>
        state.error
    );

  const loadActivity =
    useTeamActivityStore(
      (state) =>
        state.loadActivity
    );

  const clearActivity =
    useTeamActivityStore(
      (state) =>
        state.clear
    );

  const [
    setupMode,
    setSetupMode,
  ] =
    useState<SetupMode>(
      'none'
    );

  const [
    teamName,
    setTeamName,
  ] =
    useState('');

  const [
    joinCode,
    setJoinCode,
  ] =
    useState('');

  const weeklyStats =
    useMemo(
      () =>
        calculateTeamWeeklyStats(
          weeklyActivities
        ),
      [
        weeklyActivities,
      ]
    );

  const leaderboard =
    useMemo(
      () =>
        buildTeamWeeklyLeaderboard(
          members,
          weeklyStats.members
        ),
      [
        members,
        weeklyStats.members,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      let active =
        true;

      const refresh =
        async () => {
          await loadTeam();

          if (!active) {
            return;
          }

          const currentTeam =
            useTeamStore.getState()
              .team;

          if (
            currentTeam
          ) {
            await loadActivity(
              currentTeam.id
            );
          } else {
            clearActivity();
          }
        };

      refresh();

      return () => {
        active =
          false;
      };
    }, [
      loadTeam,
      loadActivity,
      clearActivity,
    ])
  );

  const handleCreate =
    async () => {
      if (
        !teamName.trim()
      ) {
        Alert.alert(
          'Team Name',
          'Enter a name for your team.'
        );

        return;
      }

      try {
        const newTeam =
          await createTeam(
            teamName
          );

        await loadActivity(
          newTeam.id
        );

        setTeamName('');

        setSetupMode(
          'none'
        );
      } catch {
        // Store already exposes error.
      }
    };

  const handleJoin =
    async () => {
      if (
        !joinCode.trim()
      ) {
        Alert.alert(
          'Team Code',
          'Enter the 6-character team code.'
        );

        return;
      }

      try {
        const joinedTeam =
          await joinTeam(
            joinCode
          );

        await loadActivity(
          joinedTeam.id
        );

        setJoinCode('');

        setSetupMode(
          'none'
        );
      } catch {
        // Store already exposes error.
      }
    };

  const handleLeave =
    () => {
      Alert.alert(
        'Leave Team',
        `Leave "${team?.name}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Leave',
            style:
              'destructive',

            onPress:
              async () => {
                try {
                  await leaveTeam();

                  clearActivity();
                } catch (
                  leaveError
                ) {
                  const message =
                    leaveError instanceof
                    Error
                      ? leaveError.message
                      : 'Unable to leave the team.';

                  Alert.alert(
                    'Unable to Leave',
                    message
                  );
                }
              },
          },
        ]
      );
    };

  if (
    isLoading &&
    !hasLoaded
  ) {
    return (
      <View
        style={
          styles.loadingRoot
        }
      >
        <ActivityIndicator
          size="large"
          color="#4ADE80"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading team...
        </Text>
      </View>
    );
  }

  /*
   * ===================================
   * NO TEAM
   * ===================================
   */

  if (!team) {
    return (
      <View
        style={
          styles.root
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={
              styles.pageTitle
            }
          >
            Team
          </Text>

          <Text
            style={
              styles.pageSubtitle
            }
          >
            Train together and
            share progress.
          </Text>

          <View
            style={
              styles.heroCard
            }
          >
            <View
              style={
                styles.heroIcon
              }
            >
              <Ionicons
                name="people"
                size={31}
                color="#4ADE80"
              />
            </View>

            <Text
              style={
                styles.heroTitle
              }
            >
              Build your crew
            </Text>

            <Text
              style={
                styles.heroDescription
              }
            >
              Create a private team
              or join one using a
              six-character invite
              code.
            </Text>
          </View>

          {error ? (
            <TouchableOpacity
              style={
                styles.errorCard
              }
              onPress={
                clearError
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color="#F87171"
              />

              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>
            </TouchableOpacity>
          ) : null}

          {setupMode ===
          'none' ? (
            <>
              <TouchableOpacity
                style={
                  styles.primaryButton
                }
                onPress={() =>
                  setSetupMode(
                    'create'
                  )
                }
              >
                <Ionicons
                  name="add"
                  size={21}
                  color="#050505"
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Create Team
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.secondaryButton
                }
                onPress={() =>
                  setSetupMode(
                    'join'
                  )
                }
              >
                <Ionicons
                  name="enter-outline"
                  size={20}
                  color="#4ADE80"
                />

                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Join Team
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {setupMode ===
          'create' ? (
            <View
              style={
                styles.formCard
              }
            >
              <Text
                style={
                  styles.formTitle
                }
              >
                Create Team
              </Text>

              <TextInput
                value={
                  teamName
                }
                onChangeText={
                  setTeamName
                }
                placeholder="e.g. NoMoS Crew"
                placeholderTextColor="#52525B"
                style={
                  styles.input
                }
                maxLength={40}
              />

              <TouchableOpacity
                style={
                  styles.primaryButton
                }
                onPress={
                  handleCreate
                }
                disabled={
                  isLoading
                }
              >
                {isLoading ? (
                  <ActivityIndicator
                    color="#050505"
                  />
                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.cancelButton
                }
                onPress={() =>
                  setSetupMode(
                    'none'
                  )
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {setupMode ===
          'join' ? (
            <View
              style={
                styles.formCard
              }
            >
              <Text
                style={
                  styles.formTitle
                }
              >
                Join Team
              </Text>

              <TextInput
                value={
                  joinCode
                }
                onChangeText={(
                  value
                ) =>
                  setJoinCode(
                    value.toUpperCase()
                  )
                }
                placeholder="ABC123"
                placeholderTextColor="#52525B"
                autoCapitalize="characters"
                autoCorrect={false}
                style={[
                  styles.input,
                  styles.codeInput,
                ]}
                maxLength={6}
              />

              <TouchableOpacity
                style={
                  styles.primaryButton
                }
                onPress={
                  handleJoin
                }
                disabled={
                  isLoading
                }
              >
                {isLoading ? (
                  <ActivityIndicator
                    color="#050505"
                  />
                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Join Team
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.cancelButton
                }
                onPress={() =>
                  setSetupMode(
                    'none'
                  )
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  const isOwner =
    team.ownerId ===
    user?.uid;

  return (
    <View
      style={
        styles.root
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text
          style={
            styles.pageTitle
          }
        >
          Team
        </Text>

        <View
          style={
            styles.teamHeader
          }
        >
          <View
            style={
              styles.teamIcon
            }
          >
            <Ionicons
              name="people"
              size={28}
              color="#4ADE80"
            />
          </View>

          <View
            style={
              styles.teamHeaderInfo
            }
          >
            <Text
              style={
                styles.teamName
              }
            >
              {team.name}
            </Text>

            <Text
              style={
                styles.memberCount
              }
            >
              {members.length}{' '}
              {members.length ===
              1
                ? 'member'
                : 'members'}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.inviteCard
          }
        >
          <Text
            style={
              styles.inviteLabel
            }
          >
            TEAM CODE
          </Text>

          <Text
            style={
              styles.inviteCode
            }
          >
            {team.joinCode}
          </Text>

          <Text
            style={
              styles.inviteDescription
            }
          >
            Share this code with
            people you want to
            invite.
          </Text>
        </View>

        {error ? (
          <TouchableOpacity
            style={
              styles.errorCard
            }
            onPress={
              clearError
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color="#F87171"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          </TouchableOpacity>
        ) : null}

        {activityError ? (
          <View
            style={
              styles.errorCard
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color="#F87171"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {activityError}
            </Text>
          </View>
        ) : null}

        {/*
         * =================================
         * THIS WEEK
         * =================================
         */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              This Week
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Since{' '}
              {new Date(
                weeklyStats.weekStart
              ).toLocaleDateString(
                undefined,
                {
                  month:
                    'short',
                  day:
                    'numeric',
                }
              )}
            </Text>
          </View>

          {activityLoading ? (
            <ActivityIndicator
              size="small"
              color="#4ADE80"
            />
          ) : null}
        </View>

        <View
          style={
            styles.weeklyGrid
          }
        >
          <View
            style={
              styles.weeklyCard
            }
          >
            <Ionicons
              name="barbell-outline"
              size={19}
              color="#4ADE80"
            />

            <Text
              style={
                styles.weeklyValue
              }
            >
              {
                weeklyStats.totalWorkouts
              }
            </Text>

            <Text
              style={
                styles.weeklyLabel
              }
            >
              WORKOUTS
            </Text>
          </View>

          <View
            style={
              styles.weeklyCard
            }
          >
            <Ionicons
              name="people-outline"
              size={19}
              color="#4ADE80"
            />

            <Text
              style={
                styles.weeklyValue
              }
            >
              {
                weeklyStats.activeMembers
              }
            </Text>

            <Text
              style={
                styles.weeklyLabel
              }
            >
              ACTIVE MEMBERS
            </Text>
          </View>

          <View
            style={
              styles.weeklyCard
            }
          >
            <Ionicons
              name="layers-outline"
              size={19}
              color="#4ADE80"
            />

            <Text
              style={
                styles.weeklyValue
              }
            >
              {
                weeklyStats.totalSets
              }
            </Text>

            <Text
              style={
                styles.weeklyLabel
              }
            >
              SETS
            </Text>
          </View>

          <View
            style={
              styles.weeklyCard
            }
          >
            <Ionicons
              name="fitness-outline"
              size={19}
              color="#4ADE80"
            />

            <Text
              style={[
                styles.weeklyValue,
                styles.weeklySmallValue,
              ]}
              numberOfLines={1}
            >
              {formatNumber(
                weeklyStats.totalVolume
              )}
            </Text>

            <Text
              style={
                styles.weeklyLabel
              }
            >
              KG VOLUME
            </Text>
          </View>
        </View>

        <View
          style={
            styles.weeklySecondary
          }
        >
          <View
            style={
              styles.weeklySecondaryItem
            }
          >
            <Text
              style={
                styles.weeklySecondaryValue
              }
            >
              {
                weeklyStats.totalReps
              }
            </Text>

            <Text
              style={
                styles.weeklySecondaryLabel
              }
            >
              Total reps
            </Text>
          </View>

          <View
            style={
              styles.weeklySecondaryDivider
            }
          />

          <View
            style={
              styles.weeklySecondaryItem
            }
          >
            <Text
              style={
                styles.weeklySecondaryValue
              }
            >
              {formatDuration(
                weeklyStats.durationSeconds
              )}
            </Text>

            <Text
              style={
                styles.weeklySecondaryLabel
              }
            >
              Training time
            </Text>
          </View>
        </View>

        {/*
         * =================================
         * WEEKLY LEADERBOARD
         * =================================
         */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Weekly Leaderboard
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Workouts first • volume
              breaks ties
            </Text>
          </View>

          <Ionicons
            name="trophy-outline"
            size={20}
            color="#FACC15"
          />
        </View>

        <View
          style={
            styles.leaderboardList
          }
        >
          {leaderboard.map(
            (
              entry
            ) => {
              const isYou =
                entry.userId ===
                user?.uid;

              const rankColor =
                getRankColor(
                  entry.rank
                );

              const initial =
                entry.displayName
                  .charAt(0)
                  .toUpperCase();

              return (
                <View
                  key={
                    entry.userId
                  }
                  style={[
                    styles.leaderboardCard,

                    isYou &&
                      styles.leaderboardCardYou,

                    entry.rank ===
                      1 &&
                      styles.leaderboardCardFirst,
                  ]}
                >
                  <View
                    style={
                      styles.rankColumn
                    }
                  >
                    <Ionicons
                      name={getRankIcon(
                        entry.rank
                      )}
                      size={
                        entry.rank <=
                        3
                          ? 22
                          : 17
                      }
                      color={
                        rankColor
                      }
                    />

                    <Text
                      style={[
                        styles.rankText,
                        {
                          color:
                            rankColor,
                        },
                      ]}
                    >
                      #
                      {
                        entry.rank
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      styles.leaderboardAvatar
                    }
                  >
                    <Text
                      style={
                        styles.leaderboardAvatarText
                      }
                    >
                      {initial}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.leaderboardInfo
                    }
                  >
                    <View
                      style={
                        styles.leaderboardNameRow
                      }
                    >
                      <Text
                        style={
                          styles.leaderboardName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          entry.displayName
                        }
                        {isYou
                          ? ' (You)'
                          : ''}
                      </Text>

                      {entry.role ===
                      'owner' ? (
                        <View
                          style={
                            styles.smallOwnerBadge
                          }
                        >
                          <Text
                            style={
                              styles.smallOwnerText
                            }
                          >
                            OWNER
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {entry.isActive ? (
                      <Text
                        style={
                          styles.leaderboardStats
                        }
                      >
                        {
                          entry.workouts
                        }{' '}
                        {entry.workouts ===
                        1
                          ? 'workout'
                          : 'workouts'}
                        {' • '}
                        {formatNumber(
                          entry.totalVolume
                        )}{' '}
                        kg
                      </Text>
                    ) : (
                      <Text
                        style={
                          styles.inactiveText
                        }
                      >
                        No workouts this
                        week
                      </Text>
                    )}

                    {entry.isActive ? (
                      <Text
                        style={
                          styles.leaderboardDetail
                        }
                      >
                        {
                          entry.totalSets
                        }{' '}
                        sets
                        {' • '}
                        {
                          entry.totalReps
                        }{' '}
                        reps
                        {' • '}
                        {formatDuration(
                          entry.durationSeconds
                        )}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            }
          )}
        </View>

        {/*
         * =================================
         * ACTIVITY
         * =================================
         */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Activity
          </Text>

          {!activityLoading ? (
            <TouchableOpacity
              onPress={() =>
                loadActivity(
                  team.id
                )
              }
            >
              <Ionicons
                name="refresh"
                size={19}
                color="#4ADE80"
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {activities.length ===
        0 ? (
          <View
            style={
              styles.emptyActivityCard
            }
          >
            <Ionicons
              name="barbell-outline"
              size={24}
              color="#52525B"
            />

            <View
              style={
                styles.emptyActivityInfo
              }
            >
              <Text
                style={
                  styles.emptyActivityTitle
                }
              >
                No team workouts yet
              </Text>

              <Text
                style={
                  styles.emptyActivityText
                }
              >
                Finish a workout
                and it will appear
                here for your team.
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={
              styles.activityList
            }
          >
            {activities.map(
              (activity) => {
                const initial =
                  activity.displayName
                    .charAt(0)
                    .toUpperCase();

                const isYourActivity =
                  activity.userId ===
                  user?.uid;

                return (
                  <View
                    key={
                      activity.id
                    }
                    style={
                      styles.activityCard
                    }
                  >
                    <View
                      style={
                        styles.activityAvatar
                      }
                    >
                      <Text
                        style={
                          styles.activityAvatarText
                        }
                      >
                        {initial}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.activityInfo
                      }
                    >
                      <Text
                        style={
                          styles.activityName
                        }
                      >
                        {
                          activity.displayName
                        }
                        {isYourActivity
                          ? ' (You)'
                          : ''}
                      </Text>

                      <Text
                        style={
                          styles.activityWorkout
                        }
                      >
                        {
                          activity.programName
                        }
                      </Text>

                      <Text
                        style={
                          styles.activityStats
                        }
                      >
                        {
                          activity.totalSets
                        }{' '}
                        sets
                        {' • '}
                        {
                          activity.totalReps
                        }{' '}
                        reps
                        {' • '}
                        {formatNumber(
                          activity.totalVolume
                        )}{' '}
                        kg
                      </Text>

                      <Text
                        style={
                          styles.activityDate
                        }
                      >
                        {formatActivityDate(
                          activity.finishedAt
                        )}
                        {' • '}
                        {formatDuration(
                          activity.durationSeconds
                        )}
                      </Text>
                    </View>
                  </View>
                );
              }
            )}
          </View>
        )}

        {/*
         * =================================
         * MEMBERS
         * =================================
         */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Members
          </Text>

          <TouchableOpacity
            onPress={
              loadTeam
            }
          >
            <Ionicons
              name="refresh"
              size={19}
              color="#4ADE80"
            />
          </TouchableOpacity>
        </View>

        <View
          style={
            styles.memberList
          }
        >
          {members.map(
            (member) => {
              const initial =
                member.displayName
                  .charAt(0)
                  .toUpperCase();

              const isYou =
                member.uid ===
                user?.uid;

              return (
                <View
                  key={
                    member.uid
                  }
                  style={
                    styles.memberCard
                  }
                >
                  <View
                    style={
                      styles.memberAvatar
                    }
                  >
                    <Text
                      style={
                        styles.memberAvatarText
                      }
                    >
                      {initial}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.memberInfo
                    }
                  >
                    <Text
                      style={
                        styles.memberName
                      }
                    >
                      {
                        member.displayName
                      }
                      {isYou
                        ? ' (You)'
                        : ''}
                    </Text>

                    <Text
                      style={
                        styles.memberEmail
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {member.email}
                    </Text>
                  </View>

                  {member.role ===
                  'owner' ? (
                    <View
                      style={
                        styles.ownerBadge
                      }
                    >
                      <Text
                        style={
                          styles.ownerText
                        }
                      >
                        OWNER
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            }
          )}
        </View>

        {isOwner ? (
          <View
            style={
              styles.ownerNotice
            }
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#4ADE80"
            />

            <Text
              style={
                styles.ownerNoticeText
              }
            >
              You own this team.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={
              styles.leaveButton
            }
            onPress={
              handleLeave
            }
          >
            <Ionicons
              name="exit-outline"
              size={19}
              color="#F87171"
            />

            <Text
              style={
                styles.leaveText
              }
            >
              Leave Team
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor:
        '#050505',
    },

    loadingRoot: {
      flex: 1,
      backgroundColor:
        '#050505',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color: '#71717A',
      fontSize: 13,
      marginTop: 12,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 58,
      paddingBottom: 110,
    },

    pageTitle: {
      color: '#F9FAFB',
      fontSize: 28,
      fontWeight: '800',
    },

    pageSubtitle: {
      color: '#71717A',
      fontSize: 13,
      marginTop: 5,
    },

    heroCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 22,
      padding: 26,
      alignItems: 'center',
      marginTop: 28,
    },

    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    heroTitle: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '900',
      marginTop: 17,
    },

    heroDescription: {
      color: '#71717A',
      fontSize: 12,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 7,
      maxWidth: 290,
    },

    primaryButton: {
      minHeight: 54,
      backgroundColor:
        '#4ADE80',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 7,
      marginTop: 14,
    },

    primaryButtonText: {
      color: '#050505',
      fontSize: 14,
      fontWeight: '900',
    },

    secondaryButton: {
      minHeight: 54,
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 7,
      marginTop: 10,
    },

    secondaryButtonText: {
      color: '#4ADE80',
      fontSize: 14,
      fontWeight: '800',
    },

    formCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 20,
      padding: 17,
      marginTop: 18,
    },

    formTitle: {
      color: '#F9FAFB',
      fontSize: 17,
      fontWeight: '900',
    },

    input: {
      minHeight: 52,
      backgroundColor:
        '#09090B',
      borderWidth: 1,
      borderColor:
        '#27272A',
      borderRadius: 14,
      color: '#F9FAFB',
      fontSize: 14,
      paddingHorizontal: 14,
      marginTop: 15,
    },

    codeInput: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 5,
      textAlign: 'center',
    },

    cancelButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent:
        'center',
      marginTop: 6,
    },

    cancelText: {
      color: '#71717A',
      fontSize: 12,
      fontWeight: '700',
    },

    errorCard: {
      minHeight: 58,
      backgroundColor:
        '#250B0B',
      borderWidth: 1,
      borderColor:
        '#7F1D1D',
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      marginTop: 14,
    },

    errorText: {
      flex: 1,
      color: '#F87171',
      fontSize: 11,
      lineHeight: 16,
      marginLeft: 9,
    },

    teamHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 26,
    },

    teamIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 13,
    },

    teamHeaderInfo: {
      flex: 1,
    },

    teamName: {
      color: '#F9FAFB',
      fontSize: 22,
      fontWeight: '900',
    },

    memberCount: {
      color: '#71717A',
      fontSize: 11,
      marginTop: 4,
    },

    inviteCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 19,
      padding: 18,
      marginTop: 22,
      alignItems: 'center',
    },

    inviteLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    inviteCode: {
      color: '#4ADE80',
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 6,
      marginTop: 8,
    },

    inviteDescription: {
      color: '#71717A',
      fontSize: 10,
      textAlign: 'center',
      marginTop: 8,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 28,
      marginBottom: 12,
    },

    sectionTitle: {
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '800',
    },

    sectionSubtitle: {
      color: '#52525B',
      fontSize: 9,
      marginTop: 3,
    },

    weeklyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
    },

    weeklyCard: {
      width: '48%',
      minHeight: 105,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 17,
      padding: 14,
    },

    weeklyValue: {
      color: '#F9FAFB',
      fontSize: 24,
      fontWeight: '900',
      marginTop: 11,
    },

    weeklySmallValue: {
      fontSize: 19,
    },

    weeklyLabel: {
      color: '#52525B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginTop: 3,
    },

    weeklySecondary: {
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 16,
      flexDirection: 'row',
      paddingVertical: 14,
      marginTop: 9,
    },

    weeklySecondaryItem: {
      flex: 1,
      alignItems: 'center',
    },

    weeklySecondaryDivider: {
      width: 1,
      backgroundColor:
        '#166534',
    },

    weeklySecondaryValue: {
      color: '#F9FAFB',
      fontSize: 15,
      fontWeight: '900',
    },

    weeklySecondaryLabel: {
      color: '#4ADE80',
      fontSize: 9,
      marginTop: 3,
    },

    leaderboardList: {
      gap: 9,
    },

    leaderboardCard: {
      minHeight: 88,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 17,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },

    leaderboardCardYou: {
      borderColor:
        '#166534',
    },

    leaderboardCardFirst: {
      backgroundColor:
        '#17170A',
      borderColor:
        '#713F12',
    },

    rankColumn: {
      width: 38,
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 5,
    },

    rankText: {
      fontSize: 9,
      fontWeight: '900',
      marginTop: 3,
    },

    leaderboardAvatar: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    leaderboardAvatarText: {
      color: '#4ADE80',
      fontSize: 16,
      fontWeight: '900',
    },

    leaderboardInfo: {
      flex: 1,
      minWidth: 0,
    },

    leaderboardNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    leaderboardName: {
      color: '#F9FAFB',
      fontSize: 13,
      fontWeight: '900',
      flexShrink: 1,
    },

    smallOwnerBadge: {
      backgroundColor:
        '#052E16',
      borderRadius: 6,
      paddingHorizontal: 5,
      paddingVertical: 3,
    },

    smallOwnerText: {
      color: '#4ADE80',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0.4,
    },

    leaderboardStats: {
      color: '#A1A1AA',
      fontSize: 10,
      fontWeight: '700',
      marginTop: 5,
    },

    leaderboardDetail: {
      color: '#52525B',
      fontSize: 9,
      marginTop: 3,
    },

    inactiveText: {
      color: '#52525B',
      fontSize: 10,
      marginTop: 5,
    },

    activityList: {
      gap: 9,
    },

    activityCard: {
      minHeight: 92,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 17,
      flexDirection: 'row',
      padding: 14,
    },

    activityAvatar: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    activityAvatarText: {
      color: '#4ADE80',
      fontSize: 16,
      fontWeight: '900',
    },

    activityInfo: {
      flex: 1,
    },

    activityName: {
      color: '#A1A1AA',
      fontSize: 10,
      fontWeight: '700',
    },

    activityWorkout: {
      color: '#F9FAFB',
      fontSize: 14,
      fontWeight: '900',
      marginTop: 3,
    },

    activityStats: {
      color: '#71717A',
      fontSize: 10,
      marginTop: 5,
    },

    activityDate: {
      color: '#52525B',
      fontSize: 9,
      marginTop: 4,
    },

    emptyActivityCard: {
      minHeight: 82,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 17,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
    },

    emptyActivityInfo: {
      flex: 1,
      marginLeft: 12,
    },

    emptyActivityTitle: {
      color: '#D4D4D8',
      fontSize: 12,
      fontWeight: '800',
    },

    emptyActivityText: {
      color: '#52525B',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    memberList: {
      gap: 9,
    },

    memberCard: {
      minHeight: 68,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
    },

    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    memberAvatarText: {
      color: '#4ADE80',
      fontSize: 15,
      fontWeight: '900',
    },

    memberInfo: {
      flex: 1,
    },

    memberName: {
      color: '#F9FAFB',
      fontSize: 12,
      fontWeight: '800',
    },

    memberEmail: {
      color: '#52525B',
      fontSize: 9,
      marginTop: 3,
    },

    ownerBadge: {
      backgroundColor:
        '#052E16',
      borderRadius: 7,
      paddingHorizontal: 7,
      paddingVertical: 5,
    },

    ownerText: {
      color: '#4ADE80',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.6,
    },

    ownerNotice: {
      minHeight: 62,
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      marginTop: 18,
    },

    ownerNoticeText: {
      flex: 1,
      color: '#A1A1AA',
      fontSize: 10,
      marginLeft: 10,
    },

    leaveButton: {
      minHeight: 52,
      backgroundColor:
        '#250B0B',
      borderWidth: 1,
      borderColor:
        '#7F1D1D',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 8,
      marginTop: 18,
    },

    leaveText: {
      color: '#F87171',
      fontSize: 13,
      fontWeight: '800',
    },
  });