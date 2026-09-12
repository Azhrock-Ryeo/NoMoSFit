import React from 'react';

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  useProgramStore,
} from '../../store/programStore';

export default function ProgramDetailScreen({
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

  const removeProgram =
    useProgramStore(
      (state) =>
        state.removeProgram
    );

  if (!program) {
    return (
      <View
        style={styles.notFoundRoot}
      >
        <Text
          style={styles.notFoundTitle}
        >
          Program not found
        </Text>

        <TouchableOpacity
          style={styles.backHomeButton}
          onPress={() =>
            navigation.goBack()
          }
        >
          <Text
            style={
              styles.backHomeText
            }
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const handleEdit = () => {
    navigation.navigate(
      'CreateProgram',
      {
        programId:
          program.id,
      }
    );
  };

  const performDelete =
    async () => {
      try {
        await removeProgram(
          program.id
        );

        navigation.goBack();
      } catch (error) {
        console.error(
          'Delete program error:',
          error
        );

        Alert.alert(
          'Delete Failed',
          'The program could not be deleted.'
        );
      }
    };

  const handleDelete = () => {
    Alert.alert(
      'Delete Program',
      `Delete "${program.name}"? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress:
            performDelete,
        },
      ]
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
          <TouchableOpacity
            style={styles.iconButton}
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

          <View
            style={styles.headerActions}
          >
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleEdit}
            >
              <Ionicons
                name="create-outline"
                size={21}
                color="#4ADE80"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.deleteIconButton
              }
              onPress={handleDelete}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color="#F87171"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={styles.titleRow}
        >
          <Text
            style={styles.title}
          >
            {program.name}
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
              {program.category}
            </Text>
          </View>
        </View>

        {program.targetMuscles
          .length > 0 ? (
          <Text style={styles.muscles}>
            {program.targetMuscles.join(
              ' • '
            )}
          </Text>
        ) : (
          <Text style={styles.muscles}>
            No specific muscle targets
          </Text>
        )}

        <View
          style={styles.statsCard}
        >
          <View style={styles.stat}>
            <Text
              style={styles.statValue}
            >
              {
                program.exercises
                  .length
              }
            </Text>

            <Text
              style={styles.statLabel}
            >
              Exercises
            </Text>
          </View>

          <View
            style={styles.divider}
          />

          <View style={styles.stat}>
            <Text
              style={styles.statValue}
            >
              {totalSets}
            </Text>

            <Text
              style={styles.statLabel}
            >
              Total Sets
            </Text>
          </View>
        </View>

        <Text
          style={styles.sectionTitle}
        >
          Exercises
        </Text>

        <View
          style={styles.exerciseList}
        >
          {program.exercises.map(
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

                <View
                  style={
                    styles.exerciseInfo
                  }
                >
                  <Text
                    style={
                      styles.exerciseName
                    }
                  >
                    {exercise.name}
                  </Text>

                  <Text
                    style={
                      styles.exerciseGoal
                    }
                  >
                    {exercise.sets}{' '}
                    sets ×{' '}
                    {
                      exercise.targetReps
                    }{' '}
                    reps
                  </Text>
                </View>
              </View>
            )
          )}
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={handleEdit}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color="#050505"
          />

          <Text
            style={
              styles.editButtonText
            }
          >
            Edit Program
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.deleteButton
          }
          onPress={handleDelete}
        >
          <Ionicons
            name="trash-outline"
            size={19}
            color="#F87171"
          />

          <Text
            style={
              styles.deleteButtonText
            }
          >
            Delete Program
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
      backgroundColor: '#050505',
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 54,
      paddingBottom: 100,
    },

    header: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 30,
    },

    headerActions: {
      flexDirection: 'row',
      gap: 10,
    },

    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      alignItems: 'center',
      justifyContent: 'center',
    },

    deleteIconButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        '#450A0A',
      borderWidth: 1,
      borderColor: '#7F1D1D',
      alignItems: 'center',
      justifyContent: 'center',
    },

    titleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
    },

    title: {
      color: '#F9FAFB',
      fontSize: 30,
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
      fontSize: 10,
      fontWeight: '900',
    },

    muscles: {
      color: '#71717A',
      fontSize: 13,
      marginTop: 8,
    },

    statsCard: {
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      borderRadius: 18,
      flexDirection: 'row',
      marginTop: 26,
      padding: 18,
    },

    stat: {
      flex: 1,
      alignItems: 'center',
    },

    statValue: {
      color: '#F9FAFB',
      fontSize: 22,
      fontWeight: '900',
    },

    statLabel: {
      color: '#71717A',
      fontSize: 11,
      marginTop: 4,
    },

    divider: {
      width: 1,
      backgroundColor:
        '#27272A',
      marginHorizontal: 16,
    },

    sectionTitle: {
      color: '#F9FAFB',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 30,
      marginBottom: 14,
    },

    exerciseList: {
      gap: 10,
    },

    exerciseCard: {
      minHeight: 74,
      backgroundColor:
        '#111827',
      borderWidth: 1,
      borderColor: '#1F2937',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },

    exerciseIndex: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 13,
    },

    exerciseIndexText: {
      color: '#4ADE80',
      fontWeight: '900',
      fontSize: 14,
    },

    exerciseInfo: {
      flex: 1,
    },

    exerciseName: {
      color: '#F9FAFB',
      fontSize: 15,
      fontWeight: '800',
    },

    exerciseGoal: {
      color: '#71717A',
      fontSize: 12,
      marginTop: 5,
    },

    editButton: {
      height: 54,
      backgroundColor:
        '#4ADE80',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 30,
    },

    editButtonText: {
      color: '#050505',
      fontSize: 15,
      fontWeight: '900',
    },

    deleteButton: {
      height: 52,
      borderRadius: 16,
      backgroundColor:
        '#450A0A',
      borderWidth: 1,
      borderColor: '#7F1D1D',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
    },

    deleteButtonText: {
      color: '#F87171',
      fontSize: 14,
      fontWeight: '800',
    },

    notFoundRoot: {
      flex: 1,
      backgroundColor: '#050505',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },

    notFoundTitle: {
      color: '#F9FAFB',
      fontSize: 20,
      fontWeight: '800',
    },

    backHomeButton: {
      backgroundColor:
        '#4ADE80',
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 14,
      marginTop: 20,
    },

    backHomeText: {
      color: '#050505',
      fontWeight: '800',
    },
  });