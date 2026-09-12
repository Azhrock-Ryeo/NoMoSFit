import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  useProgramStore,
} from '../../store/programStore';

import type {
  ProgramExercise,
  WorkoutCategory,
} from '../../types/program';

const CATEGORIES: WorkoutCategory[] = [
  'PUSH',
  'PULL',
  'LEGS',
  'CORE',
  'FULL BODY',
];

const MUSCLES = [
  'Chest',
  'Shoulders',
  'Triceps',
  'Back',
  'Biceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Obliques',
];

function createLocalId() {
  return [
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 8),
  ].join('-');
}

function createEmptyExercise():
  ProgramExercise {
  return {
    id: createLocalId(),
    name: '',
    sets: 3,
    targetReps: 8,
  };
}

export default function CreateProgramScreen({
  navigation,
  route,
}: any) {
  const programId =
    route.params?.programId as
      | string
      | undefined;

  const existingProgram =
    useProgramStore(
      (state) =>
        programId
          ? state.programs.find(
              (program) =>
                program.id ===
                programId
            )
          : undefined
    );

  const addProgram =
    useProgramStore(
      (state) =>
        state.addProgram
    );

  const editProgram =
    useProgramStore(
      (state) =>
        state.editProgram
    );

  const isEditing =
    Boolean(programId);

  const [name, setName] =
    useState('');

  const [
    category,
    setCategory,
  ] = useState<WorkoutCategory>(
    'PUSH'
  );

  const [
    targetMuscles,
    setTargetMuscles,
  ] = useState<string[]>([]);

  const [
    exercises,
    setExercises,
  ] = useState<
    ProgramExercise[]
  >([
    createEmptyExercise(),
  ]);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  useEffect(() => {
    if (!existingProgram) {
      return;
    }

    setName(
      existingProgram.name
    );

    setCategory(
      existingProgram.category
    );

    setTargetMuscles([
      ...existingProgram.targetMuscles,
    ]);

    setExercises(
      existingProgram.exercises.map(
        (exercise) => ({
          ...exercise,
        })
      )
    );
  }, [existingProgram]);

  const validExerciseCount =
    useMemo(
      () =>
        exercises.filter(
          (exercise) =>
            exercise.name
              .trim()
              .length > 0
        ).length,
      [exercises]
    );

  const toggleMuscle = (
    muscle: string
  ) => {
    setTargetMuscles(
      (current) =>
        current.includes(muscle)
          ? current.filter(
              (item) =>
                item !== muscle
            )
          : [
              ...current,
              muscle,
            ]
    );
  };

  const updateExercise = (
    id: string,
    updates: Partial<ProgramExercise>
  ) => {
    setExercises(
      (current) =>
        current.map(
          (exercise) =>
            exercise.id === id
              ? {
                  ...exercise,
                  ...updates,
                }
              : exercise
        )
    );
  };

  const changeSets = (
    id: string,
    amount: number
  ) => {
    const exercise =
      exercises.find(
        (item) =>
          item.id === id
      );

    if (!exercise) {
      return;
    }

    updateExercise(id, {
      sets: Math.max(
        1,
        Math.min(
          20,
          exercise.sets +
            amount
        )
      ),
    });
  };

  const changeReps = (
    id: string,
    amount: number
  ) => {
    const exercise =
      exercises.find(
        (item) =>
          item.id === id
      );

    if (!exercise) {
      return;
    }

    updateExercise(id, {
      targetReps: Math.max(
        1,
        Math.min(
          100,
          exercise.targetReps +
            amount
        )
      ),
    });
  };

  const addExercise = () => {
    setExercises(
      (current) => [
        ...current,
        createEmptyExercise(),
      ]
    );
  };

  const removeExercise = (
    id: string
  ) => {
    if (
      exercises.length === 1
    ) {
      Alert.alert(
        'Exercise Required',
        'A program needs at least one exercise.'
      );

      return;
    }

    setExercises(
      (current) =>
        current.filter(
          (exercise) =>
            exercise.id !== id
        )
    );
  };

  const moveExercise = (
    index: number,
    direction: -1 | 1
  ) => {
    const newIndex =
      index + direction;

    if (
      newIndex < 0 ||
      newIndex >=
        exercises.length
    ) {
      return;
    }

    setExercises(
      (current) => {
        const next = [
          ...current,
        ];

        const temp =
          next[index];

        next[index] =
          next[newIndex];

        next[newIndex] =
          temp;

        return next;
      }
    );
  };

  const handleSave =
    async () => {
      const trimmedName =
        name.trim();

      if (!trimmedName) {
        Alert.alert(
          'Program Name',
          'Enter a name for your program.'
        );

        return;
      }

      const cleanedExercises =
        exercises
          .map(
            (exercise) => ({
              ...exercise,
              name:
                exercise.name.trim(),
            })
          )
          .filter(
            (exercise) =>
              exercise.name
                .length > 0
          );

      if (
        cleanedExercises.length ===
        0
      ) {
        Alert.alert(
          'Add an Exercise',
          'Enter at least one exercise before saving.'
        );

        return;
      }

      try {
        setIsSaving(true);

        if (
          isEditing &&
          programId
        ) {
          await editProgram(
            programId,
            {
              name: trimmedName,
              category,
              targetMuscles,
              exercises:
                cleanedExercises,
            }
          );
        } else {
          await addProgram({
            name: trimmedName,
            category,
            targetMuscles,
            exercises:
              cleanedExercises,
          });
        }

        navigation.goBack();
      } catch (error) {
        console.error(
          'Save program error:',
          error
        );

        Alert.alert(
          'Save Failed',
          'The program could not be saved.'
        );
      } finally {
        setIsSaving(false);
      }
    };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
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
        <View
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.goBack()
            }
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color="#F9FAFB"
            />
          </TouchableOpacity>

          <View
            style={styles.headerText}
          >
            <Text
              style={styles.title}
            >
              {isEditing
                ? 'Edit Program'
                : 'Create Program'}
            </Text>

            <Text
              style={styles.subtitle}
            >
              {isEditing
                ? 'Update your routine.'
                : 'Build a routine you can repeat.'}
            </Text>
          </View>
        </View>

        <Text
          style={styles.sectionLabel}
        >
          PROGRAM NAME
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Push A"
          placeholderTextColor="#52525B"
          style={styles.nameInput}
          maxLength={50}
        />

        <Text
          style={styles.sectionLabel}
        >
          CATEGORY
        </Text>

        <View
          style={styles.chipContainer}
        >
          {CATEGORIES.map(
            (item) => {
              const selected =
                category === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.categoryChip,
                    selected &&
                      styles.categoryChipSelected,
                  ]}
                  onPress={() =>
                    setCategory(item)
                  }
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selected &&
                        styles.categoryChipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        <View
          style={styles.sectionHeader}
        >
          <Text
            style={
              styles.sectionLabelNoMargin
            }
          >
            TARGET MUSCLES
          </Text>

          <Text
            style={styles.optional}
          >
            OPTIONAL
          </Text>
        </View>

        <View
          style={styles.chipContainer}
        >
          {MUSCLES.map(
            (muscle) => {
              const selected =
                targetMuscles.includes(
                  muscle
                );

              return (
                <TouchableOpacity
                  key={muscle}
                  style={[
                    styles.muscleChip,
                    selected &&
                      styles.muscleChipSelected,
                  ]}
                  onPress={() =>
                    toggleMuscle(
                      muscle
                    )
                  }
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      selected &&
                        styles.muscleChipTextSelected,
                    ]}
                  >
                    {muscle}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        <View
          style={styles.exerciseHeader}
        >
          <View>
            <Text
              style={styles.exerciseTitle}
            >
              Exercises
            </Text>

            <Text
              style={
                styles.exerciseSubtitle
              }
            >
              {validExerciseCount}{' '}
              added
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.smallAddButton
            }
            onPress={addExercise}
          >
            <Ionicons
              name="add"
              size={19}
              color="#4ADE80"
            />

            <Text
              style={styles.smallAddText}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={styles.exerciseList}
        >
          {exercises.map(
            (
              exercise,
              index
            ) => (
              <View
                key={exercise.id}
                style={
                  styles.exerciseCard
                }
              >
                <View
                  style={
                    styles.exerciseCardHeader
                  }
                >
                  <View
                    style={
                      styles.exerciseIndex
                    }
                  >
                    <Text
                      style={
                        styles.exerciseIndexText
                      }
                    >
                      {index + 1}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.exerciseCardTitle
                    }
                  >
                    Exercise{' '}
                    {index + 1}
                  </Text>

                  <View
                    style={
                      styles.orderButtons
                    }
                  >
                    <TouchableOpacity
                      style={
                        styles.orderButton
                      }
                      disabled={
                        index === 0
                      }
                      onPress={() =>
                        moveExercise(
                          index,
                          -1
                        )
                      }
                    >
                      <Ionicons
                        name="arrow-up"
                        size={17}
                        color={
                          index === 0
                            ? '#3F3F46'
                            : '#A1A1AA'
                        }
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={
                        styles.orderButton
                      }
                      disabled={
                        index ===
                        exercises.length -
                          1
                      }
                      onPress={() =>
                        moveExercise(
                          index,
                          1
                        )
                      }
                    >
                      <Ionicons
                        name="arrow-down"
                        size={17}
                        color={
                          index ===
                          exercises.length -
                            1
                            ? '#3F3F46'
                            : '#A1A1AA'
                        }
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={
                        styles.removeButton
                      }
                      onPress={() =>
                        removeExercise(
                          exercise.id
                        )
                      }
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#F87171"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TextInput
                  value={exercise.name}
                  onChangeText={(
                    value
                  ) =>
                    updateExercise(
                      exercise.id,
                      {
                        name: value,
                      }
                    )
                  }
                  placeholder="Exercise name"
                  placeholderTextColor="#52525B"
                  style={
                    styles.exerciseInput
                  }
                  maxLength={60}
                />

                <View
                  style={
                    styles.numberControls
                  }
                >
                  <View
                    style={
                      styles.controlBlock
                    }
                  >
                    <Text
                      style={
                        styles.controlLabel
                      }
                    >
                      SETS
                    </Text>

                    <View
                      style={
                        styles.stepper
                      }
                    >
                      <TouchableOpacity
                        style={
                          styles.stepperButton
                        }
                        onPress={() =>
                          changeSets(
                            exercise.id,
                            -1
                          )
                        }
                      >
                        <Ionicons
                          name="remove"
                          size={20}
                          color="#D4D4D8"
                        />
                      </TouchableOpacity>

                      <Text
                        style={
                          styles.stepperValue
                        }
                      >
                        {
                          exercise.sets
                        }
                      </Text>

                      <TouchableOpacity
                        style={
                          styles.stepperButton
                        }
                        onPress={() =>
                          changeSets(
                            exercise.id,
                            1
                          )
                        }
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color="#D4D4D8"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View
                    style={
                      styles.controlBlock
                    }
                  >
                    <Text
                      style={
                        styles.controlLabel
                      }
                    >
                      GOAL REPS
                    </Text>

                    <View
                      style={styles.stepper}
                    >
                      <TouchableOpacity
                        style={
                          styles.stepperButton
                        }
                        onPress={() =>
                          changeReps(
                            exercise.id,
                            -1
                          )
                        }
                      >
                        <Ionicons
                          name="remove"
                          size={20}
                          color="#D4D4D8"
                        />
                      </TouchableOpacity>

                      <Text
                        style={
                          styles.stepperValue
                        }
                      >
                        {
                          exercise.targetReps
                        }
                      </Text>

                      <TouchableOpacity
                        style={
                          styles.stepperButton
                        }
                        onPress={() =>
                          changeReps(
                            exercise.id,
                            1
                          )
                        }
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color="#D4D4D8"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )
          )}
        </View>

        <TouchableOpacity
          style={
            styles.addExerciseButton
          }
          onPress={addExercise}
        >
          <Ionicons
            name="add-circle-outline"
            size={21}
            color="#4ADE80"
          />

          <Text
            style={
              styles.addExerciseText
            }
          >
            Add Exercise
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            isSaving &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text
            style={
              styles.saveButtonText
            }
          >
            {isSaving
              ? 'Saving...'
              : isEditing
              ? 'Save Changes'
              : 'Save Program'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#050505',
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 54,
      paddingBottom: 50,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 30,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },

    headerText: {
      flex: 1,
    },

    title: {
      color: '#F9FAFB',
      fontSize: 25,
      fontWeight: '800',
    },

    subtitle: {
      color: '#71717A',
      fontSize: 13,
      marginTop: 3,
    },

    sectionLabel: {
      color: '#71717A',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      marginBottom: 10,
      marginTop: 22,
    },

    sectionLabelNoMargin: {
      color: '#71717A',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
    },

    nameInput: {
      minHeight: 54,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      borderRadius: 16,
      color: '#F9FAFB',
      fontSize: 16,
      paddingHorizontal: 16,
    },

    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
    },

    categoryChip: {
      minHeight: 40,
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
    },

    categoryChipSelected: {
      backgroundColor:
        '#052E16',
      borderColor: '#4ADE80',
    },

    categoryChipText: {
      color: '#71717A',
      fontSize: 11,
      fontWeight: '800',
    },

    categoryChipTextSelected: {
      color: '#4ADE80',
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 28,
      marginBottom: 10,
    },

    optional: {
      color: '#3F3F46',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
    },

    muscleChip: {
      minHeight: 37,
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 13,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
    },

    muscleChipSelected: {
      backgroundColor:
        '#052E16',
      borderColor: '#166534',
    },

    muscleChipText: {
      color: '#71717A',
      fontSize: 12,
      fontWeight: '700',
    },

    muscleChipTextSelected: {
      color: '#4ADE80',
    },

    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 34,
      marginBottom: 14,
    },

    exerciseTitle: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '800',
    },

    exerciseSubtitle: {
      color: '#52525B',
      fontSize: 11,
      marginTop: 3,
    },

    smallAddButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 12,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        '#052E16',
    },

    smallAddText: {
      color: '#4ADE80',
      fontSize: 12,
      fontWeight: '800',
    },

    exerciseList: {
      gap: 12,
    },

    exerciseCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      borderRadius: 18,
      padding: 15,
    },

    exerciseCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 13,
    },

    exerciseIndex: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
    },

    exerciseIndexText: {
      color: '#4ADE80',
      fontSize: 12,
      fontWeight: '900',
    },

    exerciseCardTitle: {
      flex: 1,
      color: '#A1A1AA',
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 9,
    },

    orderButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    orderButton: {
      width: 32,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },

    removeButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },

    exerciseInput: {
      minHeight: 48,
      backgroundColor:
        '#09090B',
      borderWidth: 1,
      borderColor: '#27272A',
      borderRadius: 13,
      color: '#F9FAFB',
      fontSize: 14,
      paddingHorizontal: 14,
    },

    numberControls: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 14,
    },

    controlBlock: {
      flex: 1,
    },

    controlLabel: {
      color: '#52525B',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 7,
    },

    stepper: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#09090B',
      borderWidth: 1,
      borderColor: '#27272A',
      borderRadius: 12,
    },

    stepperButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },

    stepperValue: {
      flex: 1,
      color: '#F9FAFB',
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center',
    },

    addExerciseButton: {
      height: 50,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#166534',
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 14,
    },

    addExerciseText: {
      color: '#4ADE80',
      fontSize: 13,
      fontWeight: '800',
    },

    saveButton: {
      minHeight: 56,
      backgroundColor:
        '#4ADE80',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 30,
    },

    saveButtonDisabled: {
      opacity: 0.6,
    },

    saveButtonText: {
      color: '#050505',
      fontSize: 16,
      fontWeight: '900',
    },
  });