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

import {
  generateWorkoutInsight,
} from '../../utils/workoutInsight';

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

export default function AfterWorkoutScreen({
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
      session,
      sessions,
    ]);

  const exerciseGroups =
    useMemo(() => {
      if (!session) {
        return [];
      }

      const groups =
        new Map<
          string,
          {
            id: string;
            name: string;
            sets:
              typeof session.completedSets;
          }
        >();

      session.completedSets.forEach(
        (set) => {
          const existing =
            groups.get(
              set.exerciseId
            );

          if (existing) {
            existing.sets.push(
              set
            );

            return;
          }

          groups.set(
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
        groups.values()
      );
    }, [session]);

  const progression =
    useMemo(() => {
      if (
        !session ||
        !previousSession
      ) {
        return [];
      }

      return session.completedSets
        .map((set) => {
          const previousSet =
            previousSession.completedSets.find(
              (previous) =>
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
            id:
              set.id,

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
    }, [
      session,
      previousSession,
    ]);

  const insight =
    useMemo(() => {
      if (!session) {
        return null;
      }

      return generateWorkoutInsight(
        session,
        previousSession
      );
    }, [
      session,
      previousSession,
    ]);

  if (!session) {
    return (
      <View
        style={
          styles.centered
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Workout summary
          unavailable
        </Text>

        <TouchableOpacity
          style={
            styles.doneButton
          }
          onPress={() =>
            navigation.goBack()
          }
        >
          <Text
            style={
              styles.doneButtonText
            }
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
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

  const improvedExercises =
    new Set(
      progression.map(
        (item) =>
          item.exerciseName
      )
    ).size;

  const closeSummary =
    () => {
      navigation.goBack();
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
          style={
            styles.successIcon
          }
        >
          <Ionicons
            name="checkmark"
            size={38}
            color="#050505"
          />
        </View>

        <Text
          style={
            styles.eyebrow
          }
        >
          WORKOUT COMPLETE
        </Text>

        <Text
          style={styles.title}
        >
          {session.programName}
        </Text>

        <Text
          style={styles.date}
        >
          {new Date(
            session.finishedAt
          ).toLocaleDateString(
            undefined,
            {
              month:
                'long',
              day:
                'numeric',
              year:
                'numeric',
            }
          )}
        </Text>

        <View
          style={
            styles.mainStats
          }
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
              styles.statDivider
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
              styles.statDivider
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
          <View
            style={
              styles.volumeIcon
            }
          >
            <Ionicons
              name="barbell"
              size={22}
              color="#4ADE80"
            />
          </View>

          <View>
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

        {insight ? (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Workout Insight
            </Text>

            <View
              style={
                styles.insightCard
              }
            >
              <View
                style={
                  styles.insightIcon
                }
              >
                <Ionicons
                  name="sparkles"
                  size={21}
                  color="#4ADE80"
                />
              </View>

              <View
                style={
                  styles.insightInfo
                }
              >
                <Text
                  style={
                    styles.insightTitle
                  }
                >
                  {
                    insight.title
                  }
                </Text>

                <Text
                  style={
                    styles.insightMessage
                  }
                >
                  {
                    insight.message
                  }
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Progress
        </Text>

        {!previousSession ? (
          <View
            style={
              styles.baselineCard
            }
          >
            <Ionicons
              name="sparkles-outline"
              size={22}
              color="#4ADE80"
            />

            <View
              style={
                styles.baselineTextArea
              }
            >
              <Text
                style={
                  styles.baselineTitle
                }
              >
                Baseline
                established
              </Text>

              <Text
                style={
                  styles.baselineDescription
                }
              >
                This workout becomes
                the reference point
                for your next
                session.
              </Text>
            </View>
          </View>
        ) : progression.length >
          0 ? (
          <>
            <View
              style={
                styles.progressSummary
              }
            >
              <Ionicons
                name="trending-up"
                size={22}
                color="#4ADE80"
              />

              <View
                style={
                  styles.progressSummaryText
                }
              >
                <Text
                  style={
                    styles.progressSummaryTitle
                  }
                >
                  Progress made
                </Text>

                <Text
                  style={
                    styles.progressSummaryDescription
                  }
                >
                  Improved on{' '}
                  {improvedExercises}{' '}
                  {improvedExercises ===
                  1
                    ? 'exercise'
                    : 'exercises'}{' '}
                  compared with last
                  time.
                </Text>
              </View>
            </View>

            <View
              style={
                styles.progressList
              }
            >
              {progression
                .slice(0, 5)
                .map(
                  (item) => (
                    <View
                      key={
                        item.id
                      }
                      style={
                        styles.progressRow
                      }
                    >
                      <View
                        style={
                          styles.progressArrow
                        }
                      >
                        <Ionicons
                          name="trending-up"
                          size={17}
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
                            styles.progressExercise
                          }
                        >
                          {
                            item.exerciseName
                          }
                        </Text>

                        <Text
                          style={
                            styles.progressSet
                          }
                        >
                          Set{' '}
                          {
                            item.setNumber
                          }
                        </Text>
                      </View>

                      <View
                        style={
                          styles.progressDelta
                        }
                      >
                        {item
                          .comparison
                          .weightDelta !==
                        0 ? (
                          <Text
                            style={
                              styles.progressDeltaText
                            }
                          >
                            {formatWeightDelta(
                              item
                                .comparison
                                .weightDelta
                            )}
                          </Text>
                        ) : null}

                        {item
                          .comparison
                          .repsDelta !==
                        0 ? (
                          <Text
                            style={
                              styles.progressDeltaText
                            }
                          >
                            {formatRepDelta(
                              item
                                .comparison
                                .repsDelta
                            )}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  )
                )}
            </View>
          </>
        ) : (
          <View
            style={
              styles.matchedCard
            }
          >
            <Ionicons
              name="remove"
              size={22}
              color="#A1A1AA"
            />

            <View
              style={
                styles.baselineTextArea
              }
            >
              <Text
                style={
                  styles.baselineTitle
                }
              >
                Solid session
              </Text>

              <Text
                style={
                  styles.baselineDescription
                }
              >
                No clear increases
                over the previous
                session.
              </Text>
            </View>
          </View>
        )}

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
              index
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
                      {index + 1}
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
                          {set.reps} reps
                          {' × '}
                          {set.weight.toFixed(
                            1
                          )}{' '}
                          kg
                        </Text>

                        {comparison?.improved ? (
                          <Ionicons
                            name="arrow-up"
                            size={15}
                            color="#4ADE80"
                          />
                        ) : comparison?.declined ? (
                          <Ionicons
                            name="arrow-down"
                            size={15}
                            color="#F87171"
                          />
                        ) : (
                          <Ionicons
                            name="remove"
                            size={15}
                            color="#52525B"
                          />
                        )}
                      </View>
                    );
                  }
                )}
              </View>
            )
          )}
        </View>

        <View
          style={
            styles.savedCard
          }
        >
          <Ionicons
            name="checkmark-circle"
            size={21}
            color="#4ADE80"
          />

          <Text
            style={
              styles.savedText
            }
          >
            Saved locally and ready
            for your next progression
            comparison.
          </Text>
        </View>

        <TouchableOpacity
          style={
            styles.doneButton
          }
          onPress={
            closeSummary
          }
          activeOpacity={0.85}
        >
          <Text
            style={
              styles.doneButtonText
            }
          >
            Done
          </Text>
        </TouchableOpacity>
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
      paddingTop: 70,
      paddingBottom: 50,
      alignItems: 'center',
    },

    centered: {
      flex: 1,
      backgroundColor:
        '#050505',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },

    errorTitle: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '800',
    },

    successIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor:
        '#4ADE80',
      alignItems: 'center',
      justifyContent: 'center',
    },

    eyebrow: {
      color: '#4ADE80',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
      marginTop: 22,
    },

    title: {
      color: '#F9FAFB',
      fontSize: 30,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 7,
    },

    date: {
      color: '#71717A',
      fontSize: 11,
      marginTop: 6,
    },

    mainStats: {
      width: '100%',
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 20,
      flexDirection: 'row',
      paddingVertical: 19,
      marginTop: 28,
    },

    stat: {
      flex: 1,
      alignItems: 'center',
    },

    statDivider: {
      width: 1,
      backgroundColor:
        '#27272A',
    },

    statValue: {
      color: '#F9FAFB',
      fontSize: 19,
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
      width: '100%',
      minHeight: 72,
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginTop: 12,
    },

    volumeIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        '#064E3B',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
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

    sectionTitle: {
      width: '100%',
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 27,
      marginBottom: 12,
    },

    insightCard: {
      width: '100%',
      backgroundColor:
        '#0B0B0C',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 18,
      padding: 16,
      flexDirection: 'row',
    },

    insightIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    insightInfo: {
      flex: 1,
    },

    insightTitle: {
      color: '#4ADE80',
      fontSize: 13,
      fontWeight: '900',
    },

    insightMessage: {
      color: '#A1A1AA',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 5,
    },

    baselineCard: {
      width: '100%',
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 17,
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },

    matchedCard: {
      width: '100%',
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 17,
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },

    baselineTextArea: {
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

    progressSummary: {
      width: '100%',
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      borderRadius: 17,
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },

    progressSummaryText: {
      flex: 1,
      marginLeft: 11,
    },

    progressSummaryTitle: {
      color: '#4ADE80',
      fontSize: 12,
      fontWeight: '900',
    },

    progressSummaryDescription: {
      color: '#A1A1AA',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    progressList: {
      width: '100%',
      gap: 7,
      marginTop: 9,
    },

    progressRow: {
      minHeight: 58,
      backgroundColor:
        '#111827',
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        '#1F2937',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
    },

    progressArrow: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    progressInfo: {
      flex: 1,
    },

    progressExercise: {
      color: '#F9FAFB',
      fontSize: 11,
      fontWeight: '800',
    },

    progressSet: {
      color: '#52525B',
      fontSize: 9,
      marginTop: 2,
    },

    progressDelta: {
      alignItems: 'flex-end',
      gap: 2,
    },

    progressDeltaText: {
      color: '#4ADE80',
      fontSize: 9,
      fontWeight: '800',
    },

    exerciseList: {
      width: '100%',
      gap: 12,
    },

    exerciseCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 18,
      overflow: 'hidden',
    },

    exerciseHeader: {
      minHeight: 59,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
    },

    exerciseNumber: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    exerciseNumberText: {
      color: '#4ADE80',
      fontSize: 12,
      fontWeight: '900',
    },

    exerciseName: {
      flex: 1,
      color: '#F9FAFB',
      fontSize: 14,
      fontWeight: '800',
    },

    setRow: {
      minHeight: 50,
      borderTopWidth: 1,
      borderTopColor:
        '#1F2937',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
    },

    setNumber: {
      width: 50,
      color: '#52525B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    setPerformance: {
      flex: 1,
      color: '#D4D4D8',
      fontSize: 11,
      fontWeight: '700',
    },

    savedCard: {
      width: '100%',
      minHeight: 57,
      backgroundColor:
        '#0B0B0C',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      marginTop: 24,
    },

    savedText: {
      flex: 1,
      color: '#71717A',
      fontSize: 10,
      lineHeight: 15,
      marginLeft: 9,
    },

    doneButton: {
      width: '100%',
      minHeight: 57,
      backgroundColor:
        '#4ADE80',
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },

    doneButtonText: {
      color: '#050505',
      fontSize: 16,
      fontWeight: '900',
    },
  });