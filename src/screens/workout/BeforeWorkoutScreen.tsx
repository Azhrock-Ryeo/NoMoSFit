import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useWorkoutStore, Exercise } from '../../store/workoutStore';

export default function BeforeWorkoutScreen() {
  const navigation = useNavigation<any>();
  const { setWorkoutName, setExercises, startWorkout } = useWorkoutStore();

  const [name, setName] = useState('');
  const [exercises, setExercisesLocal] = useState<Exercise[]>([
    { id: '1', name: '', sets: 3, targetReps: 10, weight: 0 },
  ]);

  const addExercise = () => {
    setExercisesLocal([
      ...exercises,
      { id: Date.now().toString(), name: '', sets: 3, targetReps: 10, weight: 0 },
    ]);
  };

  const updateExercise = (id: string, field: keyof Exercise, value: any) => {
    setExercisesLocal(exercises.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleStart = () => {
    if (!name.trim()) return Alert.alert('Enter a workout name');
    if (exercises.some(e => !e.name.trim())) return Alert.alert('Fill in all exercise names');
    setWorkoutName(name);
    setExercises(exercises);
    startWorkout();
    navigation.navigate('DuringWorkout');
  };

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">New Workout</Text>
        <Text className="text-gray-400 text-sm mt-1">Set up your session</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <TextInput
          className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-6 text-base"
          placeholder="Workout name (e.g. Push Day)"
          placeholderTextColor="#6b7280"
          value={name}
          onChangeText={setName}
        />

        <Text className="text-white text-lg font-bold mb-3">Exercises</Text>

        {exercises.map((ex, index) => (
          <View key={ex.id} className="bg-gray-900 rounded-2xl p-4 mb-3">
            <Text className="text-gray-400 text-xs mb-2">Exercise {index + 1}</Text>
            <TextInput
              className="bg-gray-800 text-white rounded-xl px-3 py-3 mb-3"
              placeholder="Exercise name"
              placeholderTextColor="#6b7280"
              value={ex.name}
              onChangeText={(v) => updateExercise(ex.id, 'name', v)}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-gray-500 text-xs mb-1">Sets</Text>
                <TextInput
                  className="bg-gray-800 text-white rounded-xl px-3 py-2 text-center"
                  keyboardType="numeric"
                  value={ex.sets.toString()}
                  onChangeText={(v) => updateExercise(ex.id, 'sets', parseInt(v) || 0)}
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-xs mb-1">Reps</Text>
                <TextInput
                  className="bg-gray-800 text-white rounded-xl px-3 py-2 text-center"
                  keyboardType="numeric"
                  value={ex.targetReps.toString()}
                  onChangeText={(v) => updateExercise(ex.id, 'targetReps', parseInt(v) || 0)}
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-xs mb-1">Weight (kg)</Text>
                <TextInput
                  className="bg-gray-800 text-white rounded-xl px-3 py-2 text-center"
                  keyboardType="numeric"
                  value={ex.weight.toString()}
                  onChangeText={(v) => updateExercise(ex.id, 'weight', parseFloat(v) || 0)}
                />
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity onPress={addExercise} className="border border-gray-700 rounded-2xl p-4 items-center mb-6">
          <Text className="text-gray-400">+ Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      <View className="px-6 pb-8">
        <TouchableOpacity onPress={handleStart} className="bg-green-500 rounded-2xl py-4 items-center">
          <Text className="text-black font-bold text-lg">Start Workout 💪</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}