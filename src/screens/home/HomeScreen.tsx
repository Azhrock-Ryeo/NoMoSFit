import React, {
  useCallback,
  useEffect,
  useMemo,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { useAuthStore } from '../../store/authStore';
import { useProgramStore } from '../../store/programStore';

import {
  useWorkoutHistoryStore,
} from '../../store/workoutHistoryStore';

import {
  compareSet,
  formatRepDelta,
  formatWeightDelta,
} from '../../utils/progression';

function formatDuration(
  seconds: number
) {
  const minutes =
    Math.floor(seconds / 60);

  const remaining =
    seconds % 60;

  return `${minutes}:${remaining
    .toString()
    .padStart(2, '0')}`;
}

function formatDate(
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
    yesterday.getDate() - 1
  );

  const workoutDay =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  if (
    workoutDay.getTime() ===
    today.getTime()
  ) {
    return 'Today';
  }

  if (
    workoutDay.getTime() ===
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

export default function HomeScreen({
  navigation,
}: any) {
  const user =
    useAuthStore(
      (state) =>
        state.user
    );

  const programs =
    useProgramStore(
      (state) =>
        state.programs
    );

  const isLoading =
    useProgramStore(
      (state) =>
        state.isLoading
    );

  const hasLoaded =
    useProgramStore(
      (state) =>
        state.hasLoaded
    );

  const loadPrograms =
    useProgramStore(
      (state) =>
        state.loadPrograms
    );

  const sessions =
    useWorkoutHistoryStore(
      (state) =>
        state.sessions
    );

  const loadHistory =
    useWorkoutHistoryStore(
      (state) =>
        state.loadHistory
    );

  useEffect(() => {
    if (!hasLoaded) {
      loadPrograms();
    }
  }, [
    hasLoaded,
    loadPrograms,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadPrograms();
      loadHistory();
    }, [
      loadPrograms,
      loadHistory,
    ])
  );

  const getName = () => {
    if (
      user?.displayName
    ) {
      return user.displayName;
    }

    if (user?.email) {
      return user.email
        .split('@')[0]
        .replace(
          /[._-]/g,
          ' '
        );
    }

    return 'Athlete';
  };

  const getGreeting =
    () => {
      const hour =
        new Date().getHours();

      if (hour < 12) {
        return 'Good morning';
      }

      if (hour < 18) {
        return 'Good afternoon';
      }

      return 'Good evening';
    };

  const latestSession =
    sessions[0];

  const latestVolume =
    useMemo(() => {
      if (!latestSession) {
        return 0;
      }

      return latestSession.completedSets.reduce(
        (
          total,
          set
        ) =>
          total +
          set.reps *
            set.weight,
        0
      );
    }, [latestSession]);

  const progressionSummary =
    useMemo(() => {
      if (!latestSession) {
        return null;
      }

      const previousSession =
        sessions.find(
          (session) =>
            session.programId ===
              latestSession.programId &&
            session.finishedAt <
              latestSession.finishedAt
        );

      if (!previousSession) {
        return {
          type:
            'baseline' as const,

          improvedExercises:
            0,

          highlight:
            null,
        };
      }

      const improvements =
        latestSession.completedSets
          .map((set) => {
            const previousSet =
              previousSession.completedSets.find(
                (
                  previous
                ) =>
                  previous.exerciseId ===
                    set.exerciseId &&
                  previous.setNumber ===
                    set.setNumber
              );

            const comparison =
              compareSet(
                previousSet,
                set.reps,
                set.weight
              );

            if (
              !comparison ||
              !comparison.improved
            ) {
              return null;
            }

            return {
              id: set.id,

              exerciseName:
                set.exerciseName,

              setNumber:
                set.setNumber,

              comparison,
            };
          })
          .filter(
            (
              item
            ): item is NonNullable<
              typeof item
            > =>
              item !== null
          );

      const improvedExercises =
        new Set(
          improvements.map(
            (item) =>
              item.exerciseName
          )
        ).size;

      const highlight =
        improvements[0] ??
        null;

      return {
        type:
          improvements.length >
          0
            ? ('improved' as const)
            : ('matched' as const),

        improvedExercises,

        highlight,
      };
    }, [
      latestSession,
      sessions,
    ]);

  const openPrograms =
    () => {
      navigation.navigate(
        'Programs'
      );
    };

  const openHistory =
    () => {
      navigation.navigate(
        'History'
      );
    };

  const startProgram = (
    programId: string
  ) => {
    const rootNavigation =
      navigation.getParent();

    rootNavigation?.navigate(
      'Workout',
      {
        programId,
      }
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.header}
        >
          <Text
            style={
              styles.greeting
            }
          >
            {getGreeting()},
          </Text>

          <Text
            style={styles.name}
          >
            {getName()}
          </Text>
        </View>

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
              Quick Start
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Choose a program and
              train.
            </Text>
          </View>

          {programs.length >
          0 ? (
            <TouchableOpacity
              onPress={
                openPrograms
              }
            >
              <Text
                style={
                  styles.seeAllText
                }
              >
                See all
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isLoading &&
        !hasLoaded ? (
          <View
            style={
              styles.loadingCard
            }
          >
            <ActivityIndicator
              color="#4ADE80"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading programs...
            </Text>
          </View>
        ) : programs.length ===
          0 ? (
          <TouchableOpacity
            style={
              styles.emptyCard
            }
            onPress={
              openPrograms
            }
            activeOpacity={
              0.85
            }
          >
            <View
              style={
                styles.plusCircle
              }
            >
              <Ionicons
                name="add"
                size={30}
                color="#4ADE80"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Create your first
              program
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Build a reusable
              workout and it will
              appear here for
              one-tap access.
            </Text>

            <Text
              style={
                styles.emptyAction
              }
            >
              Go to Programs
            </Text>
          </TouchableOpacity>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.programRow
            }
          >
            {programs.map(
              (program) => {
                const totalSets =
                  program.exercises.reduce(
                    (
                      total,
                      exercise
                    ) =>
                      total +
                      exercise.sets,
                    0
                  );

                return (
                  <TouchableOpacity
                    key={
                      program.id
                    }
                    style={
                      styles.programCard
                    }
                    onPress={() =>
                      startProgram(
                        program.id
                      )
                    }
                    activeOpacity={
                      0.82
                    }
                  >
                    <View
                      style={
                        styles.cardTop
                      }
                    >
                      <View
                        style={
                          styles.categoryBadge
                        }
                      >
                        <Text
                          style={
                            styles.categoryText
                          }
                        >
                          {
                            program.category
                          }
                        </Text>
                      </View>

                      <View
                        style={
                          styles.playButton
                        }
                      >
                        <Ionicons
                          name="play"
                          size={17}
                          color="#050505"
                        />
                      </View>
                    </View>

                    <Text
                      style={
                        styles.programName
                      }
                      numberOfLines={
                        2
                      }
                    >
                      {
                        program.name
                      }
                    </Text>

                    {program
                      .targetMuscles
                      .length >
                    0 ? (
                      <Text
                        style={
                          styles.muscles
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {program.targetMuscles.join(
                          ' • '
                        )}
                      </Text>
                    ) : (
                      <Text
                        style={
                          styles.muscles
                        }
                      >
                        General
                        training
                      </Text>
                    )}

                    <View
                      style={
                        styles.cardBottom
                      }
                    >
                      <View>
                        <Text
                          style={
                            styles.statValue
                          }
                        >
                          {
                            program
                              .exercises
                              .length
                          }
                        </Text>

                        <Text
                          style={
                            styles.statLabel
                          }
                        >
                          EXERCISES
                        </Text>
                      </View>

                      <View
                        style={
                          styles.statDivider
                        }
                      />

                      <View>
                        <Text
                          style={
                            styles.statValue
                          }
                        >
                          {
                            totalSets
                          }
                        </Text>

                        <Text
                          style={
                            styles.statLabel
                          }
                        >
                          SETS
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={
                        styles.tapHint
                      }
                    >
                      TAP TO START
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </ScrollView>
        )}

        <View
          style={
            styles.recentHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Last Workout
          </Text>

          {latestSession ? (
            <TouchableOpacity
              onPress={
                openHistory
              }
            >
              <Text
                style={
                  styles.seeAllText
                }
              >
                History
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {latestSession ? (
          <TouchableOpacity
            style={
              styles.lastWorkoutCard
            }
            onPress={
              openHistory
            }
            activeOpacity={
              0.85
            }
          >
            <View
              style={
                styles.lastWorkoutTop
              }
            >
              <View
                style={
                  styles.lastWorkoutIcon
                }
              >
                <Ionicons
                  name="checkmark"
                  size={19}
                  color="#4ADE80"
                />
              </View>

              <View
                style={
                  styles.lastWorkoutInfo
                }
              >
                <Text
                  style={
                    styles.lastWorkoutName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {
                    latestSession.programName
                  }
                </Text>

                <Text
                  style={
                    styles.lastWorkoutDate
                  }
                >
                  {formatDate(
                    latestSession.finishedAt
                  )}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#52525B"
              />
            </View>

            <View
              style={
                styles.workoutMetrics
              }
            >
              <View
                style={
                  styles.metric
                }
              >
                <Text
                  style={
                    styles.metricValue
                  }
                >
                  {formatDuration(
                    latestSession.durationSeconds
                  )}
                </Text>

                <Text
                  style={
                    styles.metricLabel
                  }
                >
                  DURATION
                </Text>
              </View>

              <View
                style={
                  styles.metricDivider
                }
              />

              <View
                style={
                  styles.metric
                }
              >
                <Text
                  style={
                    styles.metricValue
                  }
                >
                  {
                    latestSession
                      .completedSets
                      .length
                  }
                </Text>

                <Text
                  style={
                    styles.metricLabel
                  }
                >
                  SETS
                </Text>
              </View>

              <View
                style={
                  styles.metricDivider
                }
              />

              <View
                style={
                  styles.metric
                }
              >
                <Text
                  style={
                    styles.metricValue
                  }
                  numberOfLines={
                    1
                  }
                >
                  {Math.round(
                    latestVolume
                  ).toLocaleString()}
                </Text>

                <Text
                  style={
                    styles.metricLabel
                  }
                >
                  KG
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={
              styles.noWorkoutCard
            }
          >
            <Ionicons
              name="time-outline"
              size={25}
              color="#52525B"
            />

            <Text
              style={
                styles.noWorkoutText
              }
            >
              Complete your first
              workout and your latest
              session will appear
              here.
            </Text>
          </View>
        )}

        {latestSession &&
        progressionSummary ? (
          <>
            <Text
              style={
                styles.progressSectionTitle
              }
            >
              Progression
            </Text>

            {progressionSummary.type ===
            'improved' ? (
              <View
                style={
                  styles.progressCard
                }
              >
                <View
                  style={
                    styles.progressIcon
                  }
                >
                  <Ionicons
                    name="trending-up"
                    size={22}
                    color="#4ADE80"
                  />
                </View>

                <View
                  style={
                    styles.progressInfo
                  }
                >
                  <Text
                    style={
                      styles.progressTitle
                    }
                  >
                    Progress made
                  </Text>

                  <Text
                    style={
                      styles.progressDescription
                    }
                  >
                    Improved on{' '}
                    {
                      progressionSummary.improvedExercises
                    }{' '}
                    {progressionSummary.improvedExercises ===
                    1
                      ? 'exercise'
                      : 'exercises'}{' '}
                    since your last{' '}
                    {
                      latestSession.programName
                    }{' '}
                    session.
                  </Text>

                  {progressionSummary.highlight ? (
                    <View
                      style={
                        styles.highlightRow
                      }
                    >
                      <Text
                        style={
                          styles.highlightExercise
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          progressionSummary
                            .highlight
                            .exerciseName
                        }
                      </Text>

                      <Text
                        style={
                          styles.highlightDelta
                        }
                      >
                        {progressionSummary
                          .highlight
                          .comparison
                          .weightDelta !==
                        0
                          ? formatWeightDelta(
                              progressionSummary
                                .highlight
                                .comparison
                                .weightDelta
                            )
                          : formatRepDelta(
                              progressionSummary
                                .highlight
                                .comparison
                                .repsDelta
                            )}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : progressionSummary.type ===
              'baseline' ? (
              <View
                style={
                  styles.baselineCard
                }
              >
                <Ionicons
                  name="sparkles-outline"
                  size={21}
                  color="#4ADE80"
                />

                <View
                  style={
                    styles.baselineInfo
                  }
                >
                  <Text
                    style={
                      styles.baselineTitle
                    }
                  >
                    Baseline established
                  </Text>

                  <Text
                    style={
                      styles.baselineDescription
                    }
                  >
                    Repeat this
                    program to start
                    seeing progression
                    here.
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={
                  styles.baselineCard
                }
              >
                <Ionicons
                  name="remove"
                  size={21}
                  color="#A1A1AA"
                />

                <View
                  style={
                    styles.baselineInfo
                  }
                >
                  <Text
                    style={
                      styles.baselineTitle
                    }
                  >
                    Consistent session
                  </Text>

                  <Text
                    style={
                      styles.baselineDescription
                    }
                  >
                    No clear increase
                    over your previous
                    session yet.
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : null}
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

    content: {
      paddingTop: 58,
      paddingBottom: 110,
    },

    header: {
      paddingHorizontal: 20,
      marginBottom: 38,
    },

    greeting: {
      color: '#71717A',
      fontSize: 14,
    },

    name: {
      color: '#F9FAFB',
      fontSize: 29,
      fontWeight: '800',
      marginTop: 3,
      textTransform:
        'capitalize',
    },

    sectionHeader: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-end',
      marginBottom: 16,
    },

    sectionTitle: {
      color: '#F9FAFB',
      fontSize: 20,
      fontWeight: '800',
    },

    sectionSubtitle: {
      color: '#52525B',
      fontSize: 12,
      marginTop: 4,
    },

    seeAllText: {
      color: '#4ADE80',
      fontSize: 12,
      fontWeight: '800',
    },

    loadingCard: {
      marginHorizontal: 20,
      height: 180,
      backgroundColor:
        '#111827',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color: '#71717A',
      fontSize: 12,
      marginTop: 10,
    },

    emptyCard: {
      marginHorizontal: 20,
      backgroundColor:
        '#111827',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 24,
      paddingVertical: 32,
      alignItems: 'center',
    },

    plusCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent:
        'center',
      marginBottom: 16,
    },

    emptyTitle: {
      color: '#F9FAFB',
      fontSize: 17,
      fontWeight: '800',
    },

    emptyText: {
      color: '#71717A',
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 290,
      marginTop: 8,
    },

    emptyAction: {
      color: '#4ADE80',
      fontSize: 12,
      fontWeight: '800',
      marginTop: 18,
    },

    programRow: {
      paddingLeft: 20,
      paddingRight: 8,
      gap: 12,
    },

    programCard: {
      width: 255,
      minHeight: 235,
      backgroundColor:
        '#111827',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      borderRadius: 22,
      padding: 18,
    },

    cardTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    categoryBadge: {
      backgroundColor:
        '#052E16',
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },

    categoryText: {
      color: '#4ADE80',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.6,
    },

    playButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        '#4ADE80',
      alignItems: 'center',
      justifyContent:
        'center',
      paddingLeft: 2,
    },

    programName: {
      color: '#F9FAFB',
      fontSize: 21,
      fontWeight: '900',
      marginTop: 20,
      minHeight: 52,
    },

    muscles: {
      color: '#71717A',
      fontSize: 11,
      marginTop: 5,
    },

    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 22,
    },

    statValue: {
      color: '#F9FAFB',
      fontSize: 17,
      fontWeight: '900',
    },

    statLabel: {
      color: '#52525B',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginTop: 2,
    },

    statDivider: {
      width: 1,
      height: 28,
      backgroundColor:
        '#27272A',
      marginHorizontal: 20,
    },

    tapHint: {
      color: '#4ADE80',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.3,
      marginTop: 18,
    },

    recentHeader: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginTop: 34,
      marginBottom: 13,
    },

    lastWorkoutCard: {
      marginHorizontal: 20,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 20,
      padding: 16,
    },

    lastWorkoutTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    lastWorkoutIcon: {
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

    lastWorkoutInfo: {
      flex: 1,
    },

    lastWorkoutName: {
      color: '#F9FAFB',
      fontSize: 15,
      fontWeight: '800',
    },

    lastWorkoutDate: {
      color: '#52525B',
      fontSize: 10,
      marginTop: 3,
    },

    workoutMetrics: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor:
        '#1F2937',
      marginTop: 15,
      paddingTop: 14,
    },

    metric: {
      flex: 1,
      alignItems: 'center',
    },

    metricDivider: {
      width: 1,
      backgroundColor:
        '#27272A',
    },

    metricValue: {
      color: '#D4D4D8',
      fontSize: 14,
      fontWeight: '800',
    },

    metricLabel: {
      color: '#52525B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginTop: 3,
    },

    noWorkoutCard: {
      marginHorizontal: 20,
      minHeight: 90,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 17,
    },

    noWorkoutText: {
      flex: 1,
      color: '#71717A',
      fontSize: 11,
      lineHeight: 17,
      marginLeft: 12,
    },

    progressSectionTitle: {
      color: '#F9FAFB',
      fontSize: 20,
      fontWeight: '800',
      marginHorizontal: 20,
      marginTop: 30,
      marginBottom: 13,
    },

    progressCard: {
      marginHorizontal: 20,
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 18,
      flexDirection: 'row',
      padding: 16,
    },

    progressIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        '#064E3B',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    progressInfo: {
      flex: 1,
    },

    progressTitle: {
      color: '#4ADE80',
      fontSize: 13,
      fontWeight: '900',
    },

    progressDescription: {
      color: '#A1A1AA',
      fontSize: 10,
      lineHeight: 16,
      marginTop: 4,
    },

    highlightRow: {
      minHeight: 34,
      borderTopWidth: 1,
      borderTopColor:
        '#166534',
      marginTop: 10,
      paddingTop: 9,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    highlightExercise: {
      flex: 1,
      color: '#D4D4D8',
      fontSize: 10,
      fontWeight: '700',
      marginRight: 10,
    },

    highlightDelta: {
      color: '#4ADE80',
      fontSize: 10,
      fontWeight: '900',
    },

    baselineCard: {
      marginHorizontal: 20,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },

    baselineInfo: {
      flex: 1,
      marginLeft: 11,
    },

    baselineTitle: {
      color: '#F9FAFB',
      fontSize: 12,
      fontWeight: '800',
    },

    baselineDescription: {
      color: '#71717A',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
  });