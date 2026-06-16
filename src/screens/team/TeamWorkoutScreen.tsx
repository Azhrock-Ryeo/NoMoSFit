import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function TeamWorkoutScreen() {
  const navigation = useNavigation<any>();

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">Team</Text>
        <Text className="text-gray-400 text-sm mt-1">Train together</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="bg-gray-900 rounded-2xl p-5 mb-4 items-center">
          <Text className="text-4xl mb-3">👥</Text>
          <Text className="text-white font-bold text-lg">No Team Yet</Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Create or join a team to train with others
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('CreateTeam')}
          className="bg-green-500 rounded-2xl py-4 items-center mb-3"
        >
          <Text className="text-black font-bold text-base">+ Create a Team</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('JoinTeam')}
          className="bg-gray-900 rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-semibold text-base">Join with Invite Code</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}