import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/authService';

export default function ProfileScreen() {
  const { user } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
  };

  const initial = (user?.displayName || user?.email || 'A')[0].toUpperCase();

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">Profile</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Avatar */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-green-500 items-center justify-center mb-3">
            <Text className="text-black text-4xl font-bold">{initial}</Text>
          </View>
          <Text className="text-white text-xl font-bold">
            {user?.displayName || user?.email?.split('@')[0]}
          </Text>
          <Text className="text-gray-400 text-sm">{user?.email}</Text>
        </View>

        {/* XP / Level */}
        <View className="bg-gray-900 rounded-2xl p-5 mb-4">
          <View className="flex-row justify-between mb-2">
            <Text className="text-white font-bold">Level 1</Text>
            <Text className="text-gray-400 text-sm">0 / 100 XP</Text>
          </View>
          <View className="bg-gray-800 rounded-full h-2">
            <View className="bg-green-500 rounded-full h-2 w-0" />
          </View>
          <Text className="text-gray-500 text-xs mt-2">Complete workouts to earn XP</Text>
        </View>

        {/* Stats */}
        <View className="bg-gray-900 rounded-2xl p-5 mb-4">
          <Text className="text-white font-bold mb-4">Statistics</Text>
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-400">Total Workouts</Text>
            <Text className="text-white font-bold">0</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-400">Current Streak</Text>
            <Text className="text-white font-bold">0 days</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-400">Personal Records</Text>
            <Text className="text-white font-bold">0</Text>
          </View>
        </View>

        {/* Account */}
        <View className="bg-gray-900 rounded-2xl p-5 mb-8">
          <Text className="text-white font-bold mb-4">Account</Text>
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-red-900 rounded-xl py-3 items-center"
          >
            <Text className="text-red-400 font-semibold">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}