import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/authService';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="px-6 pt-14 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-gray-400 text-sm">Welcome back,</Text>
          <Text className="text-white text-xl font-bold">
            {user?.displayName || user?.email?.split('@')[0] || 'Athlete'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-gray-800 px-4 py-2 rounded-xl"
        >
          <Text className="text-gray-400 text-sm">Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Today's Status */}
        <View className="bg-gray-900 rounded-2xl p-5 mb-4">
          <Text className="text-gray-400 text-sm mb-1">Today</Text>
          <Text className="text-white text-2xl font-bold">Ready to Train?</Text>
          <Text className="text-gray-500 text-sm mt-1">No workout logged yet today.</Text>
        </View>

        {/* Quick Actions */}
        <Text className="text-white text-lg font-bold mb-3">Quick Actions</Text>
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            onPress={() => navigation.navigate('Workout', { screen: 'BeforeWorkout' })}
            className="flex-1 bg-green-500 rounded-2xl p-5 items-center"
          >
            <Text className="text-2xl mb-1">💪</Text>
            <Text className="text-black font-bold">Start Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-gray-900 rounded-2xl p-5 items-center">
            <Text className="text-2xl mb-1">📋</Text>
            <Text className="text-white font-bold">My Plans</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <Text className="text-white text-lg font-bold mb-3">Your Stats</Text>
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-gray-900 rounded-2xl p-4 items-center">
            <Text className="text-green-400 text-2xl font-bold">0</Text>
            <Text className="text-gray-400 text-xs mt-1">Workouts</Text>
          </View>
          <View className="flex-1 bg-gray-900 rounded-2xl p-4 items-center">
            <Text className="text-green-400 text-2xl font-bold">0</Text>
            <Text className="text-gray-400 text-xs mt-1">Day Streak</Text>
          </View>
          <View className="flex-1 bg-gray-900 rounded-2xl p-4 items-center">
            <Text className="text-green-400 text-2xl font-bold">0</Text>
            <Text className="text-gray-400 text-xs mt-1">PRs Set</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <Text className="text-white text-lg font-bold mb-3">Recent Activity</Text>
        <View className="bg-gray-900 rounded-2xl p-5 items-center mb-8">
          <Text className="text-gray-500 text-sm">No recent workouts yet.</Text>
          <Text className="text-gray-600 text-xs mt-1">Start your first workout!</Text>
        </View>
      </ScrollView>
    </View>
  );
}