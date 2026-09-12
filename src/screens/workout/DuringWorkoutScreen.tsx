import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  useFocusEffect,
} from '@react-navigation/native';

import {
  useProgramStore,
} from '../../store/programStore';

import {
  useWorkoutStore,
} from '../../store/workoutStore';

import {
  useWorkoutHistoryStore,
} from '../../store/workoutHistoryStore';

import {
  findPreviousSet,
  formatWeightDelta,
} from '../../utils/progression';

import {
  publishTeamWorkoutActivity,
} from '../../services/teamActivityService';

import RestScreen from './RestScreen';

function formatTime(
  totalSeconds: number
) {
  const minutes =
    Math.floor(
      totalSeconds / 60
    );

  const seconds =
    totalSeconds % 60;

  return `${minutes
    .toString()
    .padStart(
      2,
      '0'
    )}:${seconds
    .toString()
    .padStart(
      2,
      '0'
    )}`;
}

type SaveStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'error';

export default function DuringWorkoutScreen({
  navigation,
  route,
}: any) {
  const programId =
    route.params?.programId;

  const program =
    useProgramStore(
      (state) =>
        state.programs.find(
          (item) =>
            item.id === programId
        )
    );

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

  const startWorkout =
    useWorkoutStore(
      (state) =>
        state.startWorkout
    );

  const adjustCurrentWeight =
    useWorkoutStore(
      (state) =>
        state.adjustCurrentWeight
    );

  const beginRest =
    useWorkoutStore(
      (state) =>
        state.beginRest
    );

  const resetWorkout =
    useWorkoutStore(
      (state) =>
        state.resetWorkout
    );

  const saveFinishedWorkout =
    useWorkoutHistoryStore(
      (state) =>
        state.saveFinishedWorkout
    );

  const initialized =
    useRef(false);

  const savedWorkoutId =
    useRef<string | null>(
      null
    );

  /*
   * Prevent duplicate async finish/save
   * work and duplicate navigation.
   */
  const isSavingRef =
    useRef(false);

  /*
   * Navigation is blocked while a workout
   * is active. This flag is set only when
   * we intentionally leave the screen.
   */
  const allowNavigationRef =
    useRef(false);

  /*
   * Avoid stacking multiple Android alert
   * dialogs if Back is pressed repeatedly.
   */
  const exitAlertOpenRef =
    useRef(false);

  const [
    saveStatus,
    setSaveStatus,
  ] =
    useState<SaveStatus>(
      'idle'
    );

  const [
    elapsedSeconds,
    setElapsedSeconds,
  ] =
    useState(0);

  /*
   * ===================================
   * PREPARE WORKOUT
   * ===================================
   *
   * Load history first so exercises can
   * use weights from the previous
   * session.
   */
  useEffect(() => {
    let cancelled =
      false;

    const prepareWorkout =
      async () => {
        if (
          initialized.current ||
          !program
        ) {
          return;
        }

        const historyStore =
          useWorkoutHistoryStore.getState();

        if (
          !historyStore.hasLoaded
        ) {
          await historyStore.loadHistory();
        }

        if (cancelled) {
          return;
        }

        const latestHistory =
          useWorkoutHistoryStore.getState();

        const previousSession =
          latestHistory.getLatestForProgram(
            program.id
          );

        const currentWorkout =
          useWorkoutStore.getState()
            .workout;

        if (
          !currentWorkout ||
          currentWorkout.programId !==
            program.id ||
          currentWorkout.status ===
            'finished'
        ) {
          startWorkout(
            program,
            previousSession
          );
        }

        initialized.current =
          true;
      };

    prepareWorkout();

    return () => {
      cancelled = true;
    };
  }, [
    program,
    startWorkout,
  ]);

  /*
   * ===================================
   * SAVE FINISHED WORKOUT
   * ===================================
   *
   * 1. Save locally first.
   * 2. Publish team activity separately.
   * 3. Open After Workout exactly once.
   *
   * Team publishing NEVER blocks local
   * workout completion.
   */
  useEffect(() => {
    if (
      !workout ||
      workout.status !==
        'finished' ||
      !workout.finishedAt
    ) {
      return;
    }

    if (
      savedWorkoutId.current ===
        workout.id ||
      isSavingRef.current
    ) {
      return;
    }

    savedWorkoutId.current =
      workout.id;

    isSavingRef.current =
      true;

    setSaveStatus(
      'saving'
    );

    saveFinishedWorkout(
      workout
    )
      .then(
        (
          savedSession
        ) => {
          setSaveStatus(
            'saved'
          );

          /*
           * Firebase Team publishing is
           * best-effort only.
           */
          publishTeamWorkoutActivity(
            savedSession
          ).catch(
            (error) => {
              console.error(
                'Team workout publish error:',
                error
              );
            }
          );

          /*
           * This is an intentional route
           * replacement, so allow it through
           * the leave-screen guard.
           */
          allowNavigationRef.current =
            true;

          resetWorkout();

          navigation.replace(
            'AfterWorkout',
            {
              sessionId:
                savedSession.id,
            }
          );
        }
      )
      .catch(
        (error) => {
          console.error(
            'Workout save error:',
            error
          );

          isSavingRef.current =
            false;

          savedWorkoutId.current =
            null;

          setSaveStatus(
            'error'
          );
        }
      );
  }, [
    workout,
    saveFinishedWorkout,
    navigation,
    resetWorkout,
  ]);

  /*
   * ===================================
   * WORKOUT TIMER
   * ===================================
   */
  useEffect(() => {
    if (!workout) {
      return;
    }

    const update =
      () => {
        const end =
          workout.finishedAt ??
          Date.now();

        setElapsedSeconds(
          Math.max(
            0,
            Math.floor(
              (
                end -
                workout.startedAt
              ) / 1000
            )
          )
        );
      };

    update();

    if (
      workout.status ===
      'finished'
    ) {
      return;
    }

    const interval =
      setInterval(
        update,
        1000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [
    workout?.startedAt,
    workout?.finishedAt,
    workout?.status,
  ]);

  /*
   * ===================================
   * EXIT ACTIVE WORKOUT
   * ===================================
   */

  const showExitConfirmation =
    React.useCallback(
      (
        onConfirmed?:
          () => void
      ) => {
        if (
          exitAlertOpenRef.current
        ) {
          return;
        }

        exitAlertOpenRef.current =
          true;

        Alert.alert(
          'Exit Workout?',
          'Your current workout progress has not been saved yet.',
          [
            {
              text:
                'Keep Training',

              style:
                'cancel',

              onPress:
                () => {
                  exitAlertOpenRef.current =
                    false;
                },
            },

            {
              text:
                'Exit',

              style:
                'destructive',

              onPress:
                () => {
                  exitAlertOpenRef.current =
                    false;

                  allowNavigationRef.current =
                    true;

                  resetWorkout();

                  if (
                    onConfirmed
                  ) {
                    onConfirmed();
                    return;
                  }

                  navigation.goBack();
                },
            },
          ],
          {
            cancelable:
              true,

            onDismiss:
              () => {
                exitAlertOpenRef.current =
                  false;
              },
          }
        );
      },
      [
        navigation,
        resetWorkout,
      ]
    );

  const exitWorkout =
    React.useCallback(
      () => {
        showExitConfirmation();
      },
      [
        showExitConfirmation,
      ]
    );

  /*
   * Android hardware Back.
   *
   * This is the fast path. Returning true
   * tells Android that NoMoSFit consumed
   * the Back press.
   */
  useFocusEffect(
    React.useCallback(
      () => {
        const subscription =
          BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
              const current =
                useWorkoutStore.getState()
                  .workout;

              if (!current) {
                return false;
              }

              /*
               * While the final workout is
               * being saved, do not allow a
               * Back press to interrupt it.
               */
              if (
                current.status ===
                'finished'
              ) {
                return true;
              }

              exitWorkout();

              return true;
            }
          );

        return () =>
          subscription.remove();
      },
      [
        exitWorkout,
      ]
    )
  );

  /*
   * Navigation-level fallback.
   *
   * Native-stack/system Back can attempt a
   * route removal directly on some Android
   * versions. beforeRemove catches that
   * navigation action even if the hardware
   * listener did not get first chance.
   */
  useEffect(() => {
    const unsubscribe =
      navigation.addListener(
        'beforeRemove',
        (
          event: any
        ) => {
          if (
            allowNavigationRef.current
          ) {
            return;
          }

          const current =
            useWorkoutStore.getState()
              .workout;

          if (!current) {
            return;
          }

          /*
           * Never leave in the middle of the
           * final local save.
           */
          if (
            current.status ===
              'finished'
          ) {
            event.preventDefault();
            return;
          }

          event.preventDefault();

          showExitConfirmation(
            () => {
              navigation.dispatch(
                event.data.action
              );
            }
          );
        }
      );

    return unsubscribe;
  }, [
    navigation,
    showExitConfirmation,
  ]);

  /*
   * Total planned sets.
   */
  const totalSets =
    useMemo(() => {
      if (!workout) {
        return 0;
      }

      return workout.exercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          exercise.totalSets,
        0
      );
    }, [workout]);

  /*
   * Retry only matters if local save
   * failed.
   */
  const retrySave =
    async () => {
      if (
        !workout ||
        workout.status !==
          'finished' ||
        isSavingRef.current
      ) {
        return;
      }

      try {
        isSavingRef.current =
          true;

        setSaveStatus(
          'saving'
        );

        savedWorkoutId.current =
          workout.id;

        const savedSession =
          await saveFinishedWorkout(
            workout
          );

        setSaveStatus(
          'saved'
        );

        publishTeamWorkoutActivity(
          savedSession
        ).catch(
          (error) => {
            console.error(
              'Team workout publish error:',
              error
            );
          }
        );

        allowNavigationRef.current =
          true;

        resetWorkout();

        navigation.replace(
          'AfterWorkout',
          {
            sessionId:
              savedSession.id,
          }
        );
      } catch (error) {
        console.error(
          'Workout retry save error:',
          error
        );

        isSavingRef.current =
          false;

        savedWorkoutId.current =
          null;

        setSaveStatus(
          'error'
        );
      }
    };

  /*
   * ===================================
   * PROGRAM NOT FOUND
   * ===================================
   */
  if (
    !program &&
    !workout
  ) {
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
          Program not found
        </Text>

        <TouchableOpacity
          style={
            styles.greenButton
          }
          onPress={() =>
            navigation.goBack()
          }
        >
          <Text
            style={
              styles.greenButtonText
            }
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * ===================================
   * PREPARING
   * ===================================
   */
  if (!workout) {
    return (
      <View
        style={
          styles.centered
        }
      >
        <Text
          style={
            styles.loadingText
          }
        >
          Preparing workout...
        </Text>
      </View>
    );
  }

  /*
   * ===================================
   * REST STATE
   * ===================================
   */
  if (
    workout.status ===
      'active' &&
    workout.rest
  ) {
    return (
      <RestScreen
        onExit={
          exitWorkout
        }
      />
    );
  }

  /*
   * ===================================
   * FINISHED / SAVING STATE
   * ===================================
   *
   * Do NOT show another workout-complete
   * summary here. The real summary is the
   * AfterWorkout route. This screen exists
   * only while the local save is finishing
   * or if that save needs to be retried.
   */
  if (
    workout.status ===
      'finished'
  ) {
    return (
      <View
        style={
          styles.centered
        }
      >
        {saveStatus ===
        'error' ? (
          <>
            <Ionicons
              name="alert-circle-outline"
              size={46}
              color="#F87171"
            />

            <Text
              style={[
                styles.errorTitle,
                {
                  marginTop:
                    18,
                },
              ]}
            >
              Save failed
            </Text>

            <Text
              style={[
                styles.loadingText,
                {
                  marginTop:
                    8,

                  textAlign:
                    'center',
                },
              ]}
            >
              Your workout is still in memory.
              Retry the local save before leaving.
            </Text>

            <TouchableOpacity
              style={
                styles.retryButton
              }
              onPress={
                retrySave
              }
            >
              <Text
                style={
                  styles.retryText
                }
              >
                Retry Save
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator
              size="large"
              color="#4ADE80"
            />

            <Text
              style={[
                styles.saveTitle,
                {
                  marginTop:
                    18,

                  fontSize:
                    16,
                },
              ]}
            >
              Saving workout...
            </Text>

            <Text
              style={[
                styles.loadingText,
                {
                  marginTop:
                    7,

                  textAlign:
                    'center',
                },
              ]}
            >
              Finalizing your sets, reps and
              progression.
            </Text>
          </>
        )}
      </View>
    );
  }

  /*
   * ===================================
   * ACTIVE WORKOUT
   * ===================================
   */
  const currentExercise =
    workout.exercises[
      workout.currentExerciseIndex
    ];

  if (!currentExercise) {
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
          Workout data error
        </Text>
      </View>
    );
  }

  const currentSetNumber =
    workout.currentSetIndex +
    1;

  const previousSession =
    sessions.find(
      (session) =>
        session.programId ===
        workout.programId
    );

  const previousSet =
    findPreviousSet(
      previousSession,
      currentExercise.id,
      currentSetNumber
    );

  const plannedWeightDelta =
    previousSet
      ? currentExercise.workingWeight -
        previousSet.weight
      : 0;

  const completedCount =
    workout.completedSets
      .length;

  const progress =
    totalSets > 0
      ? completedCount /
        totalSets
      : 0;

  const nextExercise =
    workout.exercises[
      workout.currentExerciseIndex +
        1
    ];

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
        <View
          style={
            styles.topBar
          }
        >
          <View>
            <Text
              style={
                styles.modeText
              }
            >
              WORKOUT
            </Text>

            <Text
              style={
                styles.workoutName
              }
              numberOfLines={
                1
              }
            >
              {
                workout.programName
              }
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.closeButton
            }
            onPress={
              exitWorkout
            }
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
            styles.statusRow
          }
        >
          <View>
            <Text
              style={
                styles.statusLabel
              }
            >
              ELAPSED
            </Text>

            <Text
              style={
                styles.timer
              }
            >
              {formatTime(
                elapsedSeconds
              )}
            </Text>
          </View>

          <View
            style={
              styles.progressTextContainer
            }
          >
            <Text
              style={
                styles.statusLabel
              }
            >
              PROGRESS
            </Text>

            <Text
              style={
                styles.progressText
              }
            >
              {completedCount}/
              {totalSets} sets
            </Text>
          </View>
        </View>

        <View
          style={
            styles.progressTrack
          }
        >
          <View
            style={[
              styles.progressFill,
              {
                width:
                  `${Math.min(
                    100,
                    progress *
                      100
                  )}%`,
              },
            ]}
          />
        </View>

        <Text
          style={
            styles.exercisePosition
          }
        >
          EXERCISE{' '}
          {workout.currentExerciseIndex +
            1}{' '}
          OF{' '}
          {
            workout.exercises
              .length
          }
        </Text>

        <Text
          style={
            styles.exerciseName
          }
        >
          {
            currentExercise.name
          }
        </Text>

        <View
          style={
            styles.setCard
          }
        >
          <Text
            style={
              styles.setLabel
            }
          >
            CURRENT SET
          </Text>

          <Text
            style={
              styles.setNumber
            }
          >
            Set{' '}
            {
              currentSetNumber
            }
          </Text>

          <Text
            style={
              styles.setOf
            }
          >
            of{' '}
            {
              currentExercise.totalSets
            }
          </Text>

          <View
            style={
              styles.targetDivider
            }
          />

          <Text
            style={
              styles.targetLabel
            }
          >
            TARGET
          </Text>

          <View
            style={
              styles.targetRow
            }
          >
            <Text
              style={
                styles.targetNumber
              }
            >
              {
                currentExercise.targetReps
              }
            </Text>

            <Text
              style={
                styles.targetUnit
              }
            >
              reps
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          WORKING WEIGHT
        </Text>

        <View
          style={
            styles.weightCard
          }
        >
          <TouchableOpacity
            style={
              styles.weightButton
            }
            onPress={() =>
              adjustCurrentWeight(
                -0.5
              )
            }
          >
            <Ionicons
              name="remove"
              size={26}
              color="#F9FAFB"
            />
          </TouchableOpacity>

          <View
            style={
              styles.weightValueContainer
            }
          >
            <Text
              style={
                styles.weightValue
              }
            >
              {currentExercise.workingWeight.toFixed(
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
              styles.weightButton
            }
            onPress={() =>
              adjustCurrentWeight(
                0.5
              )
            }
          >
            <Ionicons
              name="add"
              size={26}
              color="#F9FAFB"
            />
          </TouchableOpacity>
        </View>

        {previousSet ? (
          <View
            style={
              styles.previousCard
            }
          >
            <View>
              <Text
                style={
                  styles.previousLabel
                }
              >
                LAST TIME
              </Text>

              <Text
                style={
                  styles.previousPerformance
                }
              >
                {
                  previousSet.reps
                }{' '}
                reps Ã—{' '}
                {previousSet.weight.toFixed(
                  1
                )}{' '}
                kg
              </Text>
            </View>

            <View
              style={
                styles.todayColumn
              }
            >
              <Text
                style={
                  styles.previousLabel
                }
              >
                TODAY
              </Text>

              <Text
                style={
                  styles.todayPerformance
                }
              >
                {
                  currentExercise.targetReps
                }{' '}
                target Ã—{' '}
                {currentExercise.workingWeight.toFixed(
                  1
                )}{' '}
                kg
              </Text>

              {plannedWeightDelta !==
              0 ? (
                <Text
                  style={
                    plannedWeightDelta >
                    0
                      ? styles.positiveDelta
                      : styles.negativeDelta
                  }
                >
                  {formatWeightDelta(
                    plannedWeightDelta
                  )}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View
            style={
              styles.noPreviousCard
            }
          >
            <Ionicons
              name="sparkles-outline"
              size={18}
              color="#4ADE80"
            />

            <Text
              style={
                styles.noPreviousText
              }
            >
              No previous set â€”
              establish your
              baseline today.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={
            styles.completeButton
          }
          onPress={
            beginRest
          }
          activeOpacity={
            0.85
          }
        >
          <Ionicons
            name="checkmark"
            size={25}
            color="#050505"
          />

          <Text
            style={
              styles.completeButtonText
            }
          >
            Complete Set
          </Text>
        </TouchableOpacity>

        {nextExercise ? (
          <View
            style={
              styles.nextCard
            }
          >
            <Text
              style={
                styles.nextLabel
              }
            >
              NEXT EXERCISE
            </Text>

            <Text
              style={
                styles.nextName
              }
            >
              {
                nextExercise.name
              }
            </Text>

            <Text
              style={
                styles.nextGoal
              }
            >
              {
                nextExercise.totalSets
              }{' '}
              sets Ã—{' '}
              {
                nextExercise.targetReps
              }{' '}
              reps
            </Text>
          </View>
        ) : (
          <View
            style={
              styles.nextCard
            }
          >
            <Text
              style={
                styles.nextLabel
              }
            >
              FINAL EXERCISE
            </Text>

            <Text
              style={
                styles.nextName
              }
            >
              Finish strong.
            </Text>
          </View>
        )}

        {workout.completedSets
          .length >
        0 ? (
          <>
            <Text
              style={[
                styles.sectionLabel,
                {
                  marginTop:
                    30,
                },
              ]}
            >
              RECENT SETS
            </Text>

            <View
              style={
                styles.recentSets
              }
            >
              {workout.completedSets
                .slice(-3)
                .reverse()
                .map(
                  (
                    completedSet
                  ) => (
                    <View
                      key={
                        completedSet.id
                      }
                      style={
                        styles.completedSetRow
                      }
                    >
                      <View
                        style={
                          styles.completedCheck
                        }
                      >
                        <Ionicons
                          name="checkmark"
                          size={15}
                          color="#4ADE80"
                        />
                      </View>

                      <View
                        style={
                          styles.completedInfo
                        }
                      >
                        <Text
                          style={
                            styles.completedName
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {
                            completedSet.exerciseName
                          }
                        </Text>

                        <Text
                          style={
                            styles.completedDetails
                          }
                        >
                          Set{' '}
                          {
                            completedSet.setNumber
                          }
                          {' â€¢ '}
                          {
                            completedSet.reps
                          }{' '}
                          reps
                          {' â€¢ '}
                          {completedSet.weight.toFixed(
                            1
                          )}{' '}
                          kg
                        </Text>
                      </View>
                    </View>
                  )
                )}
            </View>
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
      paddingHorizontal: 20,
      paddingTop: 56,
      paddingBottom: 50,
    },

    centered: {
      flex: 1,
      backgroundColor:
        '#050505',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },

    loadingText: {
      color: '#71717A',
      fontSize: 14,
    },

    errorTitle: {
      color: '#F9FAFB',
      fontSize: 20,
      fontWeight: '800',
    },

    topBar: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    modeText: {
      color: '#4ADE80',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    workoutName: {
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 3,
      maxWidth: 280,
    },

    closeButton: {
      width: 44,
      height: 44,
      backgroundColor:
        '#111827',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    statusRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-end',
      marginTop: 30,
    },

    statusLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    timer: {
      color: '#F9FAFB',
      fontSize: 24,
      fontWeight: '900',
      marginTop: 5,
      fontVariant: [
        'tabular-nums',
      ],
    },

    progressTextContainer: {
      alignItems:
        'flex-end',
    },

    progressText: {
      color: '#A1A1AA',
      fontSize: 13,
      fontWeight: '800',
      marginTop: 5,
    },

    progressTrack: {
      height: 5,
      backgroundColor:
        '#18181B',
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: 13,
    },

    progressFill: {
      height: '100%',
      backgroundColor:
        '#4ADE80',
      borderRadius: 10,
    },

    exercisePosition: {
      color: '#4ADE80',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
      marginTop: 42,
    },

    exerciseName: {
      color: '#F9FAFB',
      fontSize: 32,
      lineHeight: 39,
      fontWeight: '900',
      marginTop: 8,
    },

    setCard: {
      backgroundColor:
        '#111827',
      borderColor:
        '#1F2937',
      borderWidth: 1,
      borderRadius: 22,
      padding: 22,
      marginTop: 24,
    },

    setLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    setNumber: {
      color: '#F9FAFB',
      fontSize: 32,
      fontWeight: '900',
      marginTop: 8,
    },

    setOf: {
      color: '#71717A',
      fontSize: 13,
      marginTop: 3,
    },

    targetDivider: {
      height: 1,
      backgroundColor:
        '#27272A',
      marginVertical: 20,
    },

    targetLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    targetRow: {
      flexDirection: 'row',
      alignItems:
        'baseline',
      marginTop: 5,
    },

    targetNumber: {
      color: '#4ADE80',
      fontSize: 40,
      fontWeight: '900',
    },

    targetUnit: {
      color: '#4ADE80',
      fontSize: 15,
      fontWeight: '800',
      marginLeft: 7,
    },

    sectionLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      marginTop: 24,
      marginBottom: 9,
    },

    weightCard: {
      height: 88,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 14,
    },

    weightButton: {
      width: 54,
      height: 54,
      borderRadius: 17,
      backgroundColor:
        '#18181B',
      alignItems: 'center',
      justifyContent: 'center',
    },

    weightValueContainer: {
      flexDirection: 'row',
      alignItems:
        'baseline',
    },

    weightValue: {
      color: '#F9FAFB',
      fontSize: 32,
      fontWeight: '900',
      fontVariant: [
        'tabular-nums',
      ],
    },

    weightUnit: {
      color: '#71717A',
      fontSize: 13,
      fontWeight: '700',
      marginLeft: 5,
    },

    previousCard: {
      backgroundColor:
        '#0B0B0C',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      borderRadius: 17,
      padding: 15,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginTop: 12,
    },

    previousLabel: {
      color: '#52525B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    previousPerformance: {
      color: '#A1A1AA',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 6,
    },

    todayColumn: {
      alignItems:
        'flex-end',
    },

    todayPerformance: {
      color: '#F9FAFB',
      fontSize: 12,
      fontWeight: '800',
      marginTop: 6,
    },

    positiveDelta: {
      color: '#4ADE80',
      fontSize: 10,
      fontWeight: '900',
      marginTop: 5,
    },

    negativeDelta: {
      color: '#F87171',
      fontSize: 10,
      fontWeight: '900',
      marginTop: 5,
    },

    noPreviousCard: {
      minHeight: 50,
      backgroundColor:
        '#052E16',
      borderColor:
        '#166534',
      borderWidth: 1,
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      marginTop: 12,
    },

    noPreviousText: {
      flex: 1,
      color: '#A1A1AA',
      fontSize: 10,
      lineHeight: 15,
      marginLeft: 9,
    },

    completeButton: {
      height: 60,
      backgroundColor:
        '#4ADE80',
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
    },

    completeButtonText: {
      color: '#050505',
      fontSize: 17,
      fontWeight: '900',
    },

    nextCard: {
      backgroundColor:
        '#0B0B0C',
      borderWidth: 1,
      borderColor:
        '#18181B',
      borderRadius: 18,
      padding: 17,
      marginTop: 22,
    },

    nextLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    nextName: {
      color: '#D4D4D8',
      fontSize: 15,
      fontWeight: '800',
      marginTop: 7,
    },

    nextGoal: {
      color: '#71717A',
      fontSize: 11,
      marginTop: 4,
    },

    recentSets: {
      gap: 8,
    },

    completedSetRow: {
      minHeight: 62,
      backgroundColor:
        '#0B0B0C',
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
    },

    completedCheck: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    completedInfo: {
      flex: 1,
    },

    completedName: {
      color: '#D4D4D8',
      fontSize: 13,
      fontWeight: '800',
    },

    completedDetails: {
      color: '#52525B',
      fontSize: 11,
      marginTop: 4,
    },

    finishedContent: {
      paddingHorizontal: 24,
      paddingTop: 70,
      paddingBottom: 50,
      alignItems: 'center',
    },

    finishedIcon: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor:
        '#4ADE80',
      alignItems: 'center',
      justifyContent: 'center',
    },

    finishedEyebrow: {
      color: '#4ADE80',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.5,
      marginTop: 26,
    },

    finishedTitle: {
      color: '#F9FAFB',
      fontSize: 31,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 8,
    },

    finishedMessage: {
      color: '#71717A',
      fontSize: 14,
      textAlign: 'center',
      marginTop: 7,
    },

    finishedStats: {
      width: '100%',
      backgroundColor:
        '#111827',
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        '#1F2937',
      flexDirection: 'row',
      paddingVertical: 20,
      marginTop: 30,
    },

    finishedStat: {
      flex: 1,
      alignItems: 'center',
    },

    finishedStatValue: {
      color: '#F9FAFB',
      fontSize: 22,
      fontWeight: '900',
    },

    finishedStatLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
      marginTop: 5,
    },

    verticalDivider: {
      width: 1,
      backgroundColor:
        '#27272A',
    },

    saveCard: {
      width: '100%',
      minHeight: 72,
      borderRadius: 17,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor:
        '#1F2937',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 15,
      marginTop: 16,
    },

    saveCardText: {
      flex: 1,
      marginLeft: 12,
    },

    saveTitle: {
      color: '#F9FAFB',
      fontSize: 13,
      fontWeight: '800',
    },

    saveDescription: {
      color: '#71717A',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    retryButton: {
      width: '100%',
      height: 50,
      borderRadius: 14,
      backgroundColor:
        '#450A0A',
      borderWidth: 1,
      borderColor:
        '#7F1D1D',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
    },

    retryText: {
      color: '#F87171',
      fontSize: 13,
      fontWeight: '800',
    },

    greenButton: {
      width: '100%',
      minHeight: 56,
      backgroundColor:
        '#4ADE80',
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 26,
    },

    greenButtonText: {
      color: '#050505',
      fontSize: 15,
      fontWeight: '900',
    },
  });
