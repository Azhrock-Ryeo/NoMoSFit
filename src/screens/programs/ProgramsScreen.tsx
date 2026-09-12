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

import { useProgramStore } from '../../store/programStore';

export default function ProgramsScreen({
  navigation,
}: any) {
  const programs = useProgramStore(
    (state) => state.programs
  );

  const isLoading = useProgramStore(
    (state) => state.isLoading
  );

  const hasLoaded = useProgramStore(
    (state) => state.hasLoaded
  );

  const loadPrograms = useProgramStore(
    (state) => state.loadPrograms
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
      if (hasLoaded) {
        loadPrograms();
      }
    }, [
      hasLoaded,
      loadPrograms,
    ])
  );

  const openCreateProgram = () => {
    navigation.navigate(
      'CreateProgram'
    );
  };

  const openProgram = (
    programId: string
  ) => {
    navigation.navigate(
      'ProgramDetail',
      {
        programId,
      }
    );
  };

  if (
    isLoading &&
    !hasLoaded
  ) {
    return (
      <View
        style={styles.loadingRoot}
      >
        <ActivityIndicator
          size="large"
          color="#4ADE80"
        />

        <Text
          style={styles.loadingText}
        >
          Loading programs...
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
          <View>
            <Text
              style={styles.title}
            >
              Programs
            </Text>

            <Text
              style={styles.subtitle}
            >
              Build routines you can
              repeat.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={
              openCreateProgram
            }
            activeOpacity={0.85}
          >
            <Ionicons
              name="add"
              size={26}
              color="#050505"
            />
          </TouchableOpacity>
        </View>

        {programs.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <View
              style={styles.emptyIcon}
            >
              <Ionicons
                name="barbell-outline"
                size={34}
                color="#4ADE80"
              />
            </View>

            <Text
              style={styles.emptyTitle}
            >
              No programs yet
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Create a reusable workout
              program with exercises,
              sets and target reps.
            </Text>

            <TouchableOpacity
              style={
                styles.createButton
              }
              onPress={
                openCreateProgram
              }
              activeOpacity={0.85}
            >
              <Ionicons
                name="add"
                size={20}
                color="#050505"
              />

              <Text
                style={
                  styles.createButtonText
                }
              >
                Create Program
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
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
                    key={program.id}
                    style={
                      styles.programCard
                    }
                    onPress={() =>
                      openProgram(
                        program.id
                      )
                    }
                    activeOpacity={0.82}
                  >
                    <View
                      style={
                        styles.programTop
                      }
                    >
                      <View
                        style={
                          styles.programInfo
                        }
                      >
                        <Text
                          style={
                            styles.programName
                          }
                        >
                          {
                            program.name
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
                              program.category
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

                    {program
                      .targetMuscles
                      .length > 0 ? (
                      <Text
                        style={
                          styles.muscles
                        }
                      >
                        {program.targetMuscles.join(
                          ' • '
                        )}
                      </Text>
                    ) : null}

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
                          Exercises
                        </Text>
                      </View>

                      <View
                        style={
                          styles.statDivider
                        }
                      />

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
                          {totalSets}
                        </Text>

                        <Text
                          style={
                            styles.statLabel
                          }
                        >
                          Sets
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.exercisePreview
                      }
                    >
                      {program.exercises
                        .slice(0, 3)
                        .map(
                          (
                            exercise,
                            index
                          ) => (
                            <View
                              key={
                                exercise.id
                              }
                              style={
                                styles.exerciseRow
                              }
                            >
                              <Text
                                style={
                                  styles.exerciseNumber
                                }
                              >
                                {index +
                                  1}
                              </Text>

                              <Text
                                style={
                                  styles.exerciseName
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  exercise.name
                                }
                              </Text>

                              <Text
                                style={
                                  styles.exerciseGoal
                                }
                              >
                                {
                                  exercise.sets
                                }{' '}
                                ×{' '}
                                {
                                  exercise.targetReps
                                }
                              </Text>
                            </View>
                          )
                        )}

                      {program.exercises
                        .length > 3 ? (
                        <Text
                          style={
                            styles.moreExercises
                          }
                        >
                          +
                          {program
                            .exercises
                            .length -
                            3}{' '}
                          more
                        </Text>
                      ) : null}
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
      backgroundColor: '#050505',
    },

    loadingRoot: {
      flex: 1,
      backgroundColor: '#050505',
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      color: '#71717A',
      fontSize: 13,
      marginTop: 14,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 58,
      paddingBottom: 110,
    },

    header: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
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

    addButton: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor:
        '#4ADE80',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyCard: {
      marginTop: 70,
      backgroundColor:
        '#111827',
      borderColor: '#1F2937',
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 24,
      paddingVertical: 34,
      alignItems: 'center',
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyTitle: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 18,
    },

    emptyDescription: {
      color: '#71717A',
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 280,
      marginTop: 8,
    },

    createButton: {
      minHeight: 50,
      backgroundColor:
        '#4ADE80',
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
      marginTop: 24,
      gap: 7,
    },

    createButtonText: {
      color: '#050505',
      fontSize: 14,
      fontWeight: '800',
    },

    list: {
      gap: 14,
    },

    programCard: {
      backgroundColor:
        '#111827',
      borderColor: '#1F2937',
      borderWidth: 1,
      borderRadius: 20,
      padding: 18,
    },

    programTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    programInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },

    programName: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '800',
    },

    categoryBadge: {
      backgroundColor:
        '#052E16',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },

    categoryText: {
      color: '#4ADE80',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    muscles: {
      color: '#71717A',
      fontSize: 12,
      marginTop: 9,
    },

    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
    },

    stat: {
      flex: 1,
    },

    statValue: {
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '800',
    },

    statLabel: {
      color: '#52525B',
      fontSize: 11,
      marginTop: 2,
    },

    statDivider: {
      width: 1,
      height: 30,
      backgroundColor:
        '#27272A',
      marginHorizontal: 18,
    },

    exercisePreview: {
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        '#1F2937',
    },

    exerciseRow: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
    },

    exerciseNumber: {
      width: 24,
      color: '#52525B',
      fontSize: 12,
      fontWeight: '700',
    },

    exerciseName: {
      flex: 1,
      color: '#D4D4D8',
      fontSize: 13,
    },

    exerciseGoal: {
      color: '#71717A',
      fontSize: 12,
      fontWeight: '700',
    },

    moreExercises: {
      color: '#4ADE80',
      fontSize: 11,
      fontWeight: '700',
      marginTop: 6,
    },
  });