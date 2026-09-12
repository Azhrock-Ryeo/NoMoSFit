import React, {
  useMemo,
} from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

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
    Math.floor(
      seconds / 60
    );

  const remaining =
    seconds % 60;

  return `${minutes}:${remaining
    .toString()
    .padStart(2, '0')}`;
}

export default function WorkoutDetailScreen({
  navigation,
  route,
}: any) {
  const sessionId =
    route.params?.sessionId;

  const sessions =
    useWorkoutHistoryStore(
      (state) =>
        state.sessions
    );

  const session =
    sessions.find(
      (item) =>
        item.id === sessionId
    );

  const previousSession =
    useMemo(() => {
      if (!session) {
        return undefined;
      }

      return sessions.find(
        (item) =>
          item.programId ===
            session.programId &&
          item.finishedAt <
            session.finishedAt
      );
    }, [
      sessions,
      session,
    ]);

  const exerciseGroups =
    useMemo(() => {
      if (!session) {
        return [];
      }

      const map =
        new Map<
          string,
          {
            id: string;
            name: string;
            sets: typeof session.completedSets;
          }
        >();

      session.completedSets.forEach(
        (set) => {
          const existing =
            map.get(
              set.exerciseId
            );

          if (existing) {
            existing.sets.push(
              set
            );

            return;
          }

          map.set(
            set.exerciseId,
            {
              id:
                set.exerciseId,

              name:
                set.exerciseName,

              sets: [set],
            }
          );
        }
      );

      return Array.from(
        map.values()
      );
    }, [session]);

  if (!session) {
    return (
      <View
        style={styles.centered}
      >
        <Text
          style={
            styles.notFoundTitle
          }
        >
          Workout not found
        </Text>

        <TouchableOpacity
          style={
            styles.backAction
          }
          onPress={() =>
            navigation.goBack()
          }
        >
          <Text
            style={
              styles.backActionText
            }
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const date =
    new Date(
      session.finishedAt
    );

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
          <TouchableOpacity
            style={
              styles.backButton
            }
            onPress={() =>
              navigation.goBack()
            }
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#F9FAFB"
            />
          </TouchableOpacity>
        </View>

        <View
          style={
            styles.titleRow
          }
        >
          <Text
            style={styles.title}
          >
            {
              session.programName
            }
          </Text>

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
              {session.category}
            </Text>
          </View>
        </View>

        <Text
          style={styles.dateText}
        >
          {date.toLocaleDateString(
            undefined,
            {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }
          )}
          {' • '}
          {date.toLocaleTimeString(
            undefined,
            {
              hour: 'numeric',
              minute: '2-digit',
            }
          )}
        </Text>

        <View
          style={styles.statsCard}
        >
          <View
            style={styles.stat}
          >
            <Text
              style={
                styles.statValue
              }
            >
              {formatDuration(
                session.durationSeconds
              )}
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              DURATION
            </Text>
          </View>

          <View
            style={
              styles.divider
            }
          />

          <View
            style={styles.stat}
          >
            <Text
              style={
                styles.statValue
              }
            >
              {
                session
                  .completedSets
                  .length
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

          <View
            style={
              styles.divider
            }
          />

          <View
            style={styles.stat}
          >
            <Text
              style={
                styles.statValue
              }
            >
              {totalReps}
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              REPS
            </Text>
          </View>
        </View>

        <View
          style={
            styles.volumeCard
          }
        >
          <Ionicons
            name="barbell"
            size={22}
            color="#4ADE80"
          />

          <View
            style={
              styles.volumeInfo
            }
          >
            <Text
              style={
                styles.volumeLabel
              }
            >
              TOTAL VOLUME
            </Text>

            <Text
              style={
                styles.volumeValue
              }
            >
              {totalVolume.toFixed(
                1
              )}{' '}
              kg
            </Text>
          </View>
        </View>

        {previousSession ? (
          <View
            style={
              styles.previousNotice
            }
          >
            <Ionicons
              name="git-compare-outline"
              size={20}
              color="#4ADE80"
            />

            <View
              style={
                styles.previousNoticeText
              }
            >
              <Text
                style={
                  styles.previousNoticeTitle
                }
              >
                Compared with last time
              </Text>

              <Text
                style={
                  styles.previousNoticeDescription
                }
              >
                Each set below shows
                changes from your
                previous{' '}
                {
                  session.programName
                }{' '}
                session.
              </Text>
            </View>
          </View>
        ) : null}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Exercises
        </Text>

        <View
          style={
            styles.exerciseList
          }
        >
          {exerciseGroups.map(
            (
              exercise,
              exerciseIndex
            ) => (
              <View
                key={
                  exercise.id
                }
                style={
                  styles.exerciseCard
                }
              >
                <View
                  style={
                    styles.exerciseHeader
                  }
                >
                  <View
                    style={
                      styles.exerciseNumber
                    }
                  >
                    <Text
                      style={
                        styles.exerciseNumberText
                      }
                    >
                      {exerciseIndex +
                        1}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.exerciseName
                    }
                  >
                    {exercise.name}
                  </Text>
                </View>

                <View
                  style={
                    styles.setList
                  }
                >
                  {exercise.sets.map(
                    (set) => {
                      const previousSet =
                        previousSession?.completedSets.find(
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

                      return (
                        <View
                          key={set.id}
                          style={
                            styles.setRow
                          }
                        >
                          <View
                            style={
                              styles.setMain
                            }
                          >
                            <Text
                              style={
                                styles.setNumber
                              }
                            >
                              SET{' '}
                              {
                                set.setNumber
                              }
                            </Text>

                            <Text
                              style={
                                styles.setPerformance
                              }
                            >
                              {
                                set.reps
                              }{' '}
                              reps ×{' '}
                              {set.weight.toFixed(
                                1
                              )}{' '}
                              kg
                            </Text>
                          </View>

                          {comparison ? (
                            <View
                              style={[
                                styles.progressBadge,

                                comparison.improved &&
                                  styles.progressPositive,

                                comparison.declined &&
                                  styles.progressNegative,
                              ]}
                            >
                              <Ionicons
                                name={
                                  comparison.improved
                                    ? 'trending-up'
                                    : comparison.declined
                                    ? 'trending-down'
                                    : comparison.mixed
                                    ? 'swap-horizontal'
                                    : 'remove'
                                }
                                size={14}
                                color={
                                  comparison.improved
                                    ? '#4ADE80'
                                    : comparison.declined
                                    ? '#F87171'
                                    : '#A1A1AA'
                                }
                              />

                              <Text
                                style={
                                  styles.progressText
                                }
                              >
                                {formatRepDelta(
                                  comparison.repsDelta
                                )}
                                {' • '}
                                {formatWeightDelta(
                                  comparison.weightDelta
                                )}
                              </Text>
                            </View>
                          ) : (
                            <Text
                              style={
                                styles.baselineText
                              }
                            >
                              Baseline
                            </Text>
                          )}
                        </View>
                      );
                    }
                  )}
                </View>
              </View>
            )
          )}
        </View>
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
      paddingHorizontal: 20,
      paddingTop: 54,
      paddingBottom: 110,
    },

    centered: {
      flex: 1,
      backgroundColor:
        '#050505',
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 24,
    },

    notFoundTitle: {
      color: '#F9FAFB',
      fontSize: 20,
      fontWeight: '800',
    },

    backAction: {
      backgroundColor:
        '#4ADE80',
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 13,
      marginTop: 20,
    },

    backActionText: {
      color: '#050505',
      fontWeight: '900',
    },

    header: {
      marginBottom: 26,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        '#111827',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },

    title: {
      color: '#F9FAFB',
      fontSize: 29,
      fontWeight: '900',
    },

    categoryBadge: {
      backgroundColor:
        '#052E16',
      borderRadius: 9,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },

    categoryText: {
      color: '#4ADE80',
      fontSize: 9,
      fontWeight: '900',
    },

    dateText: {
      color: '#71717A',
      fontSize: 12,
      marginTop: 8,
    },

    statsCard: {
      backgroundColor:
        '#111827',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      borderRadius: 19,
      flexDirection: 'row',
      paddingVertical: 18,
      marginTop: 25,
    },

    stat: {
      flex: 1,
      alignItems: 'center',
    },

    divider: {
      width: 1,
      backgroundColor:
        '#27272A',
    },

    statValue: {
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '900',
    },

    statLabel: {
      color: '#52525B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginTop: 4,
    },

    volumeCard: {
      minHeight: 70,
      borderRadius: 17,
      backgroundColor:
        '#052E16',
      borderColor:
        '#166534',
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 17,
      marginTop: 12,
    },

    volumeInfo: {
      marginLeft: 12,
    },

    volumeLabel: {
      color: '#71717A',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    volumeValue: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '900',
      marginTop: 3,
    },

    previousNotice: {
      backgroundColor:
        '#0B0B0C',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      borderRadius: 16,
      flexDirection: 'row',
      padding: 14,
      marginTop: 12,
    },

    previousNoticeText: {
      flex: 1,
      marginLeft: 10,
    },

    previousNoticeTitle: {
      color: '#F9FAFB',
      fontSize: 12,
      fontWeight: '800',
    },

    previousNoticeDescription: {
      color: '#71717A',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    sectionTitle: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 28,
      marginBottom: 14,
    },

    exerciseList: {
      gap: 13,
    },

    exerciseCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 19,
      overflow: 'hidden',
    },

    exerciseHeader: {
      minHeight: 65,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
    },

    exerciseNumber: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    exerciseNumberText: {
      color: '#4ADE80',
      fontSize: 13,
      fontWeight: '900',
    },

    exerciseName: {
      flex: 1,
      color: '#F9FAFB',
      fontSize: 15,
      fontWeight: '800',
    },

    setList: {
      borderTopWidth: 1,
      borderTopColor:
        '#1F2937',
    },

    setRow: {
      minHeight: 72,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        '#18181B',
    },

    setMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    setNumber: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    setPerformance: {
      color: '#D4D4D8',
      fontSize: 12,
      fontWeight: '800',
    },

    progressBadge: {
      minHeight: 28,
      borderRadius: 9,
      backgroundColor:
        '#18181B',
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf:
        'flex-start',
      paddingHorizontal: 9,
      marginTop: 8,
      gap: 6,
    },

    progressPositive: {
      backgroundColor:
        '#052E16',
    },

    progressNegative: {
      backgroundColor:
        '#250B0B',
    },

    progressText: {
      color: '#A1A1AA',
      fontSize: 9,
      fontWeight: '700',
    },

    baselineText: {
      color: '#52525B',
      fontSize: 9,
      marginTop: 8,
    },
  });