import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useWorkoutStore } from '../../store/workoutStore';

export default function DuringWorkoutScreen() {
  const navigation = useNavigation<any>();
  const { workoutName, exercises, logSet, exerciseLogs } = useWorkoutStore();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [timer, setTimer] = useState(0);
  const [resting, setResting] = useState(false);
  const [restTimer, setRestTimer] = useState(0);

  const currentExercise = exercises[currentExerciseIndex];

  // Workout timer
  useEffect(() => {
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Rest timer
  useEffect(() => {
    if (!resting) return;
    if (restTimer === 0) { setResting(false); return; }
    const interval = setInterval(() => setRestTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resting, restTimer]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleLogSet = () => {
    if (!reps) return Alert.alert('Enter reps completed');
    logSet(currentExercise.id, currentExercise.name, {
      setNumber: currentSet,
      achievedReps: parseInt(reps),
      weight: parseFloat(weight) || currentExercise.weight,
      completedAt: new Date().toISOString(),
    });
    setReps('');
    setResting(true);
    setRestTimer(60);

    if (currentSet < currentExercise.sets) {
      setCurrentSet(currentSet + 1);
    } else if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSet(1);
    }
  };

  const handleFinish = () => {
    Alert.alert('Finish Workout?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: () => navigation.navigate('AfterWorkout') },
    ]);
  };

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="px-6 pt-14 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-gray-400 text-sm">In Progress</Text>
          <Text className="text-white text-xl font-bold">{workoutName}</Text>
        </View>
        <View className="bg-gray-900 px-4 py-2 rounded-xl">
          <Text className="text-green-400 font-bold">{formatTime(timer)}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Rest Timer */}
        {resting && (
          <View className="bg-blue-900 rounded-2xl p-4 mb-4 items-center">
            <Text className="text-blue-300 text-sm">Rest Time</Text>
            <Text className="text-white text-4xl font-bold">{formatTime(restTimer)}</Text>
            <TouchableOpacity onPress={() => setResting(false)} className="mt-2">
              <Text className="text-blue-300 text-sm">Skip Rest</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Exercise */}
        <View className="bg-gray-900 rounded-2xl p-5 mb-4">
          <View className="flex-row justify-between mb-1">
            <Text className="text-gray-400 text-xs">
              Exercise {currentExerciseIndex + 1}/{exercises.length}
            </Text>
            <Text className="text-gray-400 text-xs">
              Set {currentSet}/{currentExercise?.sets}
            </Text>
          </View>
          <Text className="text-white text-2xl font-bold mb-1">{currentExercise?.name}</Text>
          <Text className="text-gray-400 text-sm">
            Target: {currentExercise?.targetReps} reps @ {currentExercise?.weight}kg
          </Text>
        </View>

        {/* Log Set */}
        <View className="bg-gray-900 rounded-2xl p-5 mb-4">
          <Text className="text-white font-bold mb-3">Log Set {currentSet}</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-gray-400 text-xs mb-1">Reps Done</Text>
              <TextInput
                className="bg-gray-800 text-white rounded-xl px-3 py-3 text-center text-lg"
                keyboardType="numeric"
                value={reps}
                onChangeText={setReps}
                placeholder={currentExercise?.targetReps.toString()}
                placeholderTextColor="#6b7280"
              />
            </View>
            <View className="flex-1">
              <Text className="text-gray-400 text-xs mb-1">Weight (kg)</Text>
              <TextInput
                className="bg-gray-800 text-white rounded-xl px-3 py-3 text-center text-lg"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                placeholder={currentExercise?.weight.toString()}
                placeholderTextColor="#6b7280"
              />
            </View>
          </View>
          <TouchableOpacity
            onPress={handleLogSet}
            className="bg-green-500 rounded-xl py-3 items-center mt-3"
          >
            <Text className="text-black font-bold">✓ Log Set</Text>
          </TouchableOpacity>
        </View>

        {/* Exercise List */}
        <Text className="text-white font-bold mb-3">All Exercises</Text>
        {exercises.map((ex, i) => (
          <View key={ex.id} className={`rounded-xl p-3 mb-2 flex-row justify-between ${i === currentExerciseIndex ? 'bg-green-900' : 'bg-gray-900'}`}>
            <Text className={i === currentExerciseIndex ? 'text-green-300' : 'text-gray-400'}>
              {ex.name}
            </Text>
            <Text className="text-gray-500 text-xs">{ex.sets}x{ex.targetReps}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="px-6 pb-8 pt-2">
        <TouchableOpacity onPress={handleFinish} className="bg-red-600 rounded-2xl py-4 items-center">
          <Text className="text-white font-bold text-lg">Finish Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}