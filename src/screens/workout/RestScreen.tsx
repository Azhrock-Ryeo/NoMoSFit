import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FlatList,
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
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  useWorkoutStore,
} from '../../store/workoutStore';

import {
  useWorkoutHistoryStore,
} from '../../store/workoutHistoryStore';

import {
  compareSet,
  findPreviousSet,
  formatRepDelta,
  formatWeightDelta,
} from '../../utils/progression';

const REP_VALUES =
  Array.from(
    {
      length: 100,
    },
    (_, index) =>
      index + 1
  );

const REP_ITEM_WIDTH = 64;

function formatTime(
  seconds: number
) {
  const safeSeconds =
    Math.max(
      0,
      seconds
    );

  const minutes =
    Math.floor(
      safeSeconds / 60
    );

  const remaining =
    safeSeconds % 60;

  return `${minutes}:${remaining
    .toString()
    .padStart(
      2,
      '0'
    )}`;
}

interface RestScreenProps {
  onExit: () => void;
}

export default function RestScreen({
  onExit,
}: RestScreenProps) {
  const insets =
    useSafeAreaInsets();

  const workout =
    useWorkoutStore(
      (state) =>
        state.workout
    );

  const sessions =
    useWorkoutHistoryStore(
      (state) =>
        state.sessions
    );

  const setRestReps =
    useWorkoutStore(
      (state) =>
        state.setRestReps
    );

  const adjustRestWeight =
    useWorkoutStore(
      (state) =>
        state.adjustRestWeight
    );

  const finishRest =
    useWorkoutStore(
      (state) =>
        state.finishRest
    );

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(0);

  const rest =
    workout?.rest;

  useEffect(() => {
    if (!rest) {
      return;
    }

    const updateTimer = () => {
      const elapsed =
        Math.floor(
          (
            Date.now() -
            rest.startedAt
          ) / 1000
        );

      setRemainingSeconds(
        Math.max(
          0,
          rest.durationSeconds -
            elapsed
        )
      );
    };

    updateTimer();

    const interval =
      setInterval(
        updateTimer,
        250
      );

    return () => {
      clearInterval(
        interval
      );
    };
  }, [
    rest?.startedAt,
    rest?.durationSeconds,
  ]);

  const previousSession =
    useMemo(() => {
      if (!workout) {
        return undefined;
      }

      return sessions.find(
        (session) =>
          session.programId ===
          workout.programId
      );
    }, [
      sessions,
      workout?.programId,
    ]);

  const context =
    useMemo(() => {
      if (
        !workout ||
        !rest
      ) {
        return null;
      }

      const exercise =
        workout.exercises[
          rest.exerciseIndex
        ];

      if (!exercise) {
        return null;
      }

      const setNumber =
        rest.setIndex + 1;

      const previousSet =
        findPreviousSet(
          previousSession,
          exercise.id,
          setNumber
        );

      const comparison =
        compareSet(
          previousSet,
          rest.reps,
          exercise.workingWeight
        );

      const isLastSet =
        rest.setIndex >=
        exercise.totalSets -
          1;

      const isLastExercise =
        rest.exerciseIndex >=
        workout.exercises
          .length -
          1;

      const isWorkoutComplete =
        isLastSet &&
        isLastExercise;

      if (
        isWorkoutComplete
      ) {
        return {
          exercise,
          previousSet,
          comparison,

          isWorkoutComplete,

          nextExercise: null,

          nextSetNumber: null,

          buttonText:
            'Finish Workout',
        };
      }

      if (!isLastSet) {
        return {
          exercise,
          previousSet,
          comparison,

          isWorkoutComplete,

          nextExercise:
            exercise,

          nextSetNumber:
            rest.setIndex +
            2,

          buttonText:
            'Start Next Set',
        };
      }

      const nextExercise =
        workout.exercises[
          rest.exerciseIndex +
            1
        ];

      return {
        exercise,
        previousSet,
        comparison,

        isWorkoutComplete,

        nextExercise,

        nextSetNumber: 1,

        buttonText:
          'Start Next Exercise',
      };
    }, [
      workout,
      rest,
      previousSession,
    ]);

  if (
    !workout ||
    !rest ||
    !context
  ) {
    return null;
  }

  const timerComplete =
    remainingSeconds === 0;

  const comparison =
    context.comparison;

  return (
    <View
      style={styles.root}
    >
      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop:
              Math.max(
                insets.top,
                18
              ),
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
        nestedScrollEnabled
      >
        <View
          style={styles.topBar}
        >
          <View style={styles.topInfo}>
            <Text
              style={styles.eyebrow}
            >
              SET COMPLETE
            </Text>

            <Text
              style={
                styles.exerciseName
              }
              numberOfLines={1}
            >
              {
                context.exercise
                  .name
              }
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.closeButton
            }
            onPress={onExit}
          >
            <Ionicons
              name="close"
              size={23}
              color="#F9FAFB"
            />
          </TouchableOpacity>
        </View>

        <View
          style={
            styles.timerContainer
          }
        >
          <Text
            style={
              styles.timerLabel
            }
          >
            {timerComplete
              ? 'READY'
              : 'REST'}
          </Text>

          <Text
            style={[
              styles.timer,

              timerComplete &&
                styles.timerReady,
            ]}
          >
            {formatTime(
              remainingSeconds
            )}
          </Text>

          <Text
            style={
              styles.timerHint
            }
          >
            {timerComplete
              ? 'Rest complete. Start when ready.'
              : 'Recover before your next set.'}
          </Text>
        </View>

        <Text
          style={styles.label}
        >
          ACTUAL REPS
        </Text>

        <Text
          style={
            styles.repInstruction
          }
        >
          Swipe or tap to record
          what you actually completed.
        </Text>

        <View
          style={
            styles.repPickerContainer
          }
        >
          <FlatList
            data={REP_VALUES}
            horizontal
            keyExtractor={(
              item
            ) =>
              item.toString()
            }
            showsHorizontalScrollIndicator={
              false
            }
            snapToInterval={
              REP_ITEM_WIDTH +
              5
            }
            decelerationRate="fast"
            initialScrollIndex={
              Math.max(
                0,
                rest.reps - 1
              )
            }
            getItemLayout={(
              _,
              index
            ) => ({
              length:
                REP_ITEM_WIDTH +
                5,

              offset:
                (
                  REP_ITEM_WIDTH +
                  5
                ) * index,

              index,
            })}
            onMomentumScrollEnd={(
              event
            ) => {
              const index =
                Math.round(
                  event.nativeEvent
                    .contentOffset.x /
                    (
                      REP_ITEM_WIDTH +
                      5
                    )
                );

              const reps =
                REP_VALUES[
                  Math.max(
                    0,
                    Math.min(
                      REP_VALUES.length -
                        1,
                      index
                    )
                  )
                ];

              setRestReps(
                reps
              );
            }}
            renderItem={({
              item,
            }) => {
              const selected =
                item ===
                rest.reps;

              return (
                <TouchableOpacity
                  style={[
                    styles.repItem,

                    selected &&
                      styles.repItemSelected,
                  ]}
                  onPress={() =>
                    setRestReps(
                      item
                    )
                  }
                >
                  <Text
                    style={[
                      styles.repValue,

                      selected &&
                        styles.repValueSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View
          style={
            styles.selectedReps
          }
        >
          <Text
            style={
              styles.selectedRepsNumber
            }
          >
            {rest.reps}
          </Text>

          <Text
            style={
              styles.selectedRepsUnit
            }
          >
            reps recorded
          </Text>
        </View>

        {context.previousSet ? (
          <View
            style={
              styles.comparisonCard
            }
          >
            <Text
              style={
                styles.comparisonHeading
              }
            >
              PROGRESSION
            </Text>

            <View
              style={
                styles.compareColumns
              }
            >
              <View
                style={
                  styles.compareColumn
                }
              >
                <Text
                  style={
                    styles.compareLabel
                  }
                >
                  LAST TIME
                </Text>

                <Text
                  style={
                    styles.compareMain
                  }
                >
                  {
                    context.previousSet
                      .reps
                  }{' '}
                  reps
                </Text>

                <Text
                  style={
                    styles.compareSecondary
                  }
                >
                  {context.previousSet.weight.toFixed(
                    1
                  )}{' '}
                  kg
                </Text>
              </View>

              <View
                style={
                  styles.compareDivider
                }
              />

              <View
                style={
                  styles.compareColumn
                }
              >
                <Text
                  style={
                    styles.compareLabel
                  }
                >
                  THIS SET
                </Text>

                <Text
                  style={
                    styles.compareMain
                  }
                >
                  {rest.reps} reps
                </Text>

                <Text
                  style={
                    styles.compareSecondary
                  }
                >
                  {context.exercise.workingWeight.toFixed(
                    1
                  )}{' '}
                  kg
                </Text>
              </View>
            </View>

            {comparison ? (
              <View
                style={[
                  styles.deltaBox,

                  comparison.improved &&
                    styles.deltaPositive,

                  comparison.declined &&
                    styles.deltaNegative,

                  comparison.mixed &&
                    styles.deltaMixed,
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
                  size={18}
                  color={
                    comparison.improved
                      ? '#4ADE80'
                      : comparison.declined
                      ? '#F87171'
                      : '#A1A1AA'
                  }
                />

                <View
                  style={
                    styles.deltaTextContainer
                  }
                >
                  <Text
                    style={
                      styles.deltaTitle
                    }
                  >
                    {comparison.improved
                      ? 'Progress'
                      : comparison.declined
                      ? 'Below last time'
                      : comparison.mixed
                      ? 'Mixed result'
                      : 'Matched last time'}
                  </Text>

                  <Text
                    style={
                      styles.deltaDetails
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
              </View>
            ) : null}
          </View>
        ) : (
          <View
            style={
              styles.firstTimeCard
            }
          >
            <Ionicons
              name="sparkles-outline"
              size={20}
              color="#4ADE80"
            />

            <View
              style={
                styles.firstTimeText
              }
            >
              <Text
                style={
                  styles.firstTimeTitle
                }
              >
                First recorded attempt
              </Text>

              <Text
                style={
                  styles.firstTimeDescription
                }
              >
                This becomes your
                baseline for the next
                workout.
              </Text>
            </View>
          </View>
        )}

        {!context.isWorkoutComplete ? (
          <>
            <Text
              style={styles.label}
            >
              NEXT WEIGHT
            </Text>

            <View
              style={
                styles.weightCard
              }
            >
              <TouchableOpacity
                style={
                  styles.fineButton
                }
                onPress={() =>
                  adjustRestWeight(
                    -0.5
                  )
                }
              >
                <Ionicons
                  name="remove"
                  size={23}
                  color="#F9FAFB"
                />

                <Text
                  style={
                    styles.fineButtonText
                  }
                >
                  0.5
                </Text>
              </TouchableOpacity>

              <View
                style={
                  styles.weightCenter
                }
              >
                <Text
                  style={
                    styles.weightValue
                  }
                >
                  {rest.nextWeight.toFixed(
                    1
                  )}
                </Text>

                <Text
                  style={
                    styles.weightUnit
                  }
                >
                  kg
                </Text>
              </View>

              <TouchableOpacity
                style={
                  styles.fineButton
                }
                onPress={() =>
                  adjustRestWeight(
                    0.5
                  )
                }
              >
                <Ionicons
                  name="add"
                  size={23}
                  color="#F9FAFB"
                />

                <Text
                  style={
                    styles.fineButtonText
                  }
                >
                  0.5
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.loadRow
              }
            >
              <TouchableOpacity
                style={
                  styles.deloadButton
                }
                onPress={() =>
                  adjustRestWeight(
                    -2.5
                  )
                }
              >
                <Ionicons
                  name="trending-down"
                  size={19}
                  color="#F87171"
                />

                <View>
                  <Text
                    style={
                      styles.deloadTitle
                    }
                  >
                    DELOAD
                  </Text>

                  <Text
                    style={
                      styles.loadAmount
                    }
                  >
                    -2.5 kg
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.loadButton
                }
                onPress={() =>
                  adjustRestWeight(
                    2.5
                  )
                }
              >
                <Ionicons
                  name="trending-up"
                  size={19}
                  color="#4ADE80"
                />

                <View>
                  <Text
                    style={
                      styles.loadTitle
                    }
                  >
                    LOAD
                  </Text>

                  <Text
                    style={
                      styles.loadAmount
                    }
                  >
                    +2.5 kg
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <View
          style={styles.nextCard}
        >
          <Text
            style={
              styles.nextLabel
            }
          >
            {context.isWorkoutComplete
              ? 'UP NEXT'
              : 'NEXT'}
          </Text>

          {context.isWorkoutComplete ? (
            <>
              <Text
                style={
                  styles.nextName
                }
              >
                Workout complete
              </Text>

              <Text
                style={
                  styles.nextDetails
                }
              >
                Confirm your reps and
                finish the session.
              </Text>
            </>
          ) : (
            <>
              <Text
                style={
                  styles.nextName
                }
              >
                {
                  context.nextExercise
                    ?.name
                }
              </Text>

              <Text
                style={
                  styles.nextDetails
                }
              >
                Set{' '}
                {
                  context.nextSetNumber
                }{' '}
                of{' '}
                {
                  context.nextExercise
                    ?.totalSets
                }
                {' • '}
                {
                  context.nextExercise
                    ?.targetReps
                }{' '}
                target reps
              </Text>
            </>
          )}
        </View>

        <View
          style={styles.scrollBottomSpace}
        />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                12
              ),
          },
        ]}
      >
        <TouchableOpacity
          style={
            styles.continueButton
          }
          onPress={
            finishRest
          }
          activeOpacity={0.85}
        >
          <Text
            style={
              styles.continueText
            }
          >
            {
              context.buttonText
            }
          </Text>

          <Ionicons
            name={
              context.isWorkoutComplete
                ? 'checkmark'
                : 'arrow-forward'
            }
            size={22}
            color="#050505"
          />
        </TouchableOpacity>

        {!timerComplete &&
        !context.isWorkoutComplete ? (
          <Text
            style={
              styles.skipHint
            }
          >
            You can continue before
            the timer ends.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#050505',
    },

    scroll: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal: 20,
    },

    scrollBottomSpace: {
      height: 18,
    },

    topBar: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    topInfo: {
      flex: 1,
      paddingRight: 12,
    },

    eyebrow: {
      color: '#4ADE80',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.4,
    },

    exerciseName: {
      color: '#F9FAFB',
      fontSize: 17,
      fontWeight: '800',
      marginTop: 4,
    },

    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      alignItems: 'center',
      justifyContent: 'center',
    },

    timerContainer: {
      alignItems: 'center',
      marginTop: 18,
    },

    timerLabel: {
      color: '#71717A',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    timer: {
      color: '#F9FAFB',
      fontSize: 52,
      fontWeight: '900',
      fontVariant: [
        'tabular-nums',
      ],
    },

    timerReady: {
      color: '#4ADE80',
    },

    timerHint: {
      color: '#52525B',
      fontSize: 10,
    },

    label: {
      color: '#71717A',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      marginTop: 17,
      marginBottom: 6,
    },

    repInstruction: {
      color: '#52525B',
      fontSize: 10,
      marginBottom: 8,
    },

    repPickerContainer: {
      height: 57,
    },

    repItem: {
      width: REP_ITEM_WIDTH,
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      marginRight: 5,
    },

    repItemSelected: {
      backgroundColor: '#052E16',
      borderColor: '#4ADE80',
    },

    repValue: {
      color: '#71717A',
      fontSize: 20,
      fontWeight: '800',
    },

    repValueSelected: {
      color: '#4ADE80',
      fontSize: 23,
      fontWeight: '900',
    },

    selectedReps: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      marginTop: 5,
    },

    selectedRepsNumber: {
      color: '#4ADE80',
      fontSize: 20,
      fontWeight: '900',
    },

    selectedRepsUnit: {
      color: '#71717A',
      fontSize: 10,
      marginLeft: 5,
    },

    comparisonCard: {
      backgroundColor: '#111827',
      borderColor: '#1F2937',
      borderWidth: 1,
      borderRadius: 17,
      padding: 14,
      marginTop: 14,
    },

    comparisonHeading: {
      color: '#52525B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    compareColumns: {
      flexDirection: 'row',
      marginTop: 11,
    },

    compareColumn: {
      flex: 1,
    },

    compareDivider: {
      width: 1,
      backgroundColor: '#27272A',
      marginHorizontal: 14,
    },

    compareLabel: {
      color: '#71717A',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    compareMain: {
      color: '#F9FAFB',
      fontSize: 16,
      fontWeight: '900',
      marginTop: 4,
    },

    compareSecondary: {
      color: '#71717A',
      fontSize: 11,
      marginTop: 2,
    },

    deltaBox: {
      minHeight: 48,
      backgroundColor: '#18181B',
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      marginTop: 12,
    },

    deltaPositive: {
      backgroundColor: '#052E16',
    },

    deltaNegative: {
      backgroundColor: '#250B0B',
    },

    deltaMixed: {
      backgroundColor: '#18181B',
    },

    deltaTextContainer: {
      flex: 1,
      marginLeft: 9,
    },

    deltaTitle: {
      color: '#F9FAFB',
      fontSize: 11,
      fontWeight: '800',
    },

    deltaDetails: {
      color: '#A1A1AA',
      fontSize: 9,
      marginTop: 2,
    },

    firstTimeCard: {
      backgroundColor: '#052E16',
      borderColor: '#166534',
      borderWidth: 1,
      borderRadius: 15,
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
    },

    firstTimeText: {
      flex: 1,
      marginLeft: 10,
    },

    firstTimeTitle: {
      color: '#F9FAFB',
      fontSize: 11,
      fontWeight: '800',
    },

    firstTimeDescription: {
      color: '#71717A',
      fontSize: 9,
      lineHeight: 14,
      marginTop: 2,
    },

    weightCard: {
      height: 70,
      backgroundColor: '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 12,
    },

    fineButton: {
      width: 55,
      height: 48,
      backgroundColor: '#18181B',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    fineButtonText: {
      color: '#71717A',
      fontSize: 9,
      fontWeight: '800',
      marginTop: -2,
    },

    weightCenter: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },

    weightValue: {
      color: '#F9FAFB',
      fontSize: 28,
      fontWeight: '900',
    },

    weightUnit: {
      color: '#71717A',
      fontSize: 12,
      marginLeft: 5,
    },

    loadRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 9,
    },

    deloadButton: {
      flex: 1,
      height: 50,
      backgroundColor: '#250B0B',
      borderWidth: 1,
      borderColor: '#7F1D1D',
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },

    loadButton: {
      flex: 1,
      height: 50,
      backgroundColor: '#052E16',
      borderWidth: 1,
      borderColor: '#166534',
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },

    deloadTitle: {
      color: '#F87171',
      fontSize: 10,
      fontWeight: '900',
    },

    loadTitle: {
      color: '#4ADE80',
      fontSize: 10,
      fontWeight: '900',
    },

    loadAmount: {
      color: '#71717A',
      fontSize: 9,
    },

    nextCard: {
      backgroundColor: '#0B0B0C',
      borderWidth: 1,
      borderColor: '#1F2937',
      borderRadius: 15,
      padding: 12,
      marginTop: 13,
    },

    nextLabel: {
      color: '#52525B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    nextName: {
      color: '#F9FAFB',
      fontSize: 14,
      fontWeight: '800',
      marginTop: 4,
    },

    nextDetails: {
      color: '#71717A',
      fontSize: 10,
      marginTop: 3,
    },

    footer: {
      backgroundColor: '#050505',
      borderTopWidth: 1,
      borderTopColor: '#18181B',
      paddingHorizontal: 20,
      paddingTop: 10,
    },

    continueButton: {
      minHeight: 56,
      backgroundColor: '#4ADE80',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },

    continueText: {
      color: '#050505',
      fontSize: 15,
      fontWeight: '900',
    },

    skipHint: {
      color: '#52525B',
      textAlign: 'center',
      fontSize: 9,
      marginTop: 6,
    },
  });
