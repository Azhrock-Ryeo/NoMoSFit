import React, {
  useCallback,
  useEffect,
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

import {
  useWorkoutHistoryStore,
} from '../../store/workoutHistoryStore';

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

  const today =
    new Date();

  const yesterday =
    new Date();

  yesterday.setDate(
    today.getDate() - 1
  );

  const sameDay = (
    a: Date,
    b: Date
  ) =>
    a.getFullYear() ===
      b.getFullYear() &&
    a.getMonth() ===
      b.getMonth() &&
    a.getDate() ===
      b.getDate();

  if (
    sameDay(
      date,
      today
    )
  ) {
    return 'Today';
  }

  if (
    sameDay(
      date,
      yesterday
    )
  ) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year:
        date.getFullYear() !==
        today.getFullYear()
          ? 'numeric'
          : undefined,
    }
  );
}

function formatTime(
  timestamp: number
) {
  return new Date(
    timestamp
  ).toLocaleTimeString(
    undefined,
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  );
}

export default function HistoryScreen({
  navigation,
}: any) {
  const sessions =
    useWorkoutHistoryStore(
      (state) =>
        state.sessions
    );

  const isLoading =
    useWorkoutHistoryStore(
      (state) =>
        state.isLoading
    );

  const hasLoaded =
    useWorkoutHistoryStore(
      (state) =>
        state.hasLoaded
    );

  const loadHistory =
    useWorkoutHistoryStore(
      (state) =>
        state.loadHistory
    );

  useEffect(() => {
    if (!hasLoaded) {
      loadHistory();
    }
  }, [
    hasLoaded,
    loadHistory,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

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
          Loading history...
        </Text>
      </View>
    );
  }

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
            style={styles.title}
          >
            History
          </Text>

          <Text
            style={styles.subtitle}
          >
            Your completed workouts.
          </Text>
        </View>

        {sessions.length ===
        0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name="time-outline"
                size={34}
                color="#4ADE80"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No workouts yet
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Finish a workout and it
              will appear here with
              your sets, reps and
              weights.
            </Text>
          </View>
        ) : (
          <View
            style={styles.list}
          >
            {sessions.map(
              (session) => {
                const exerciseIds =
                  new Set(
                    session.completedSets.map(
                      (set) =>
                        set.exerciseId
                    )
                  );

                const volume =
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

                return (
                  <TouchableOpacity
                    key={session.id}
                    style={
                      styles.sessionCard
                    }
                    activeOpacity={0.82}
                    onPress={() =>
                      navigation.navigate(
                        'WorkoutDetail',
                        {
                          sessionId:
                            session.id,
                        }
                      )
                    }
                  >
                    <View
                      style={
                        styles.cardTop
                      }
                    >
                      <View
                        style={
                          styles.cardTitleArea
                        }
                      >
                        <Text
                          style={
                            styles.sessionName
                          }
                          numberOfLines={
                            1
                          }
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
                            {
                              session.category
                            }
                          </Text>
                        </View>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#52525B"
                      />
                    </View>

                    <Text
                      style={
                        styles.dateText
                      }
                    >
                      {formatDate(
                        session.finishedAt
                      )}
                      {' • '}
                      {formatTime(
                        session.finishedAt
                      )}
                    </Text>

                    <View
                      style={
                        styles.statsRow
                      }
                    >
                      <View
                        style={
                          styles.stat
                        }
                      >
                        <Text
                          style={
                            styles.statValue
                          }
                        >
                          {
                            exerciseIds.size
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
                          styles.stat
                        }
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
                          styles.stat
                        }
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
                    </View>

                    <View
                      style={
                        styles.volumeRow
                      }
                    >
                      <Ionicons
                        name="barbell-outline"
                        size={16}
                        color="#4ADE80"
                      />

                      <Text
                        style={
                          styles.volumeText
                        }
                      >
                        {volume.toFixed(
                          1
                        )}{' '}
                        kg total volume
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
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

    header: {
      marginBottom: 28,
    },

    title: {
      color: '#F9FAFB',
      fontSize: 28,
      fontWeight: '800',
    },

    subtitle: {
      color: '#71717A',
      fontSize: 14,
      marginTop: 5,
    },

    list: {
      gap: 14,
    },

    sessionCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 20,
      padding: 18,
    },

    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    cardTitleArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 9,
    },

    sessionName: {
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '800',
      maxWidth: '70%',
    },

    categoryBadge: {
      backgroundColor:
        '#052E16',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
    },

    categoryText: {
      color: '#4ADE80',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    dateText: {
      color: '#71717A',
      fontSize: 11,
      marginTop: 8,
    },

    statsRow: {
      flexDirection: 'row',
      marginTop: 20,
    },

    stat: {
      flex: 1,
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
      letterSpacing: 0.7,
      marginTop: 3,
    },

    volumeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor:
        '#1F2937',
      marginTop: 17,
      paddingTop: 13,
      gap: 7,
    },

    volumeText: {
      color: '#A1A1AA',
      fontSize: 11,
      fontWeight: '700',
    },

    emptyCard: {
      marginTop: 70,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 22,
      alignItems: 'center',
      padding: 32,
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 18,
    },

    emptyDescription: {
      color: '#71717A',
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 280,
    },
  });