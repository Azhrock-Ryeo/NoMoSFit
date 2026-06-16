import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function CreateTeamScreen() {
  const navigation = useNavigation<any>();
  const [teamName, setTeamName] = useState('');

  const handleCreate = () => {
    if (!teamName.trim()) return Alert.alert('Enter a team name');
    Alert.alert('Coming Soon', 'Team creation will be available in Phase 4');
  };

  return (
    <View className="flex-1 bg-black px-6">
      <View className="pt-14 pb-6">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mb-4">
          <Text className="text-green-400">← Back</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Create Team</Text>
        <Text className="text-gray-400 text-sm mt-1">Set up your fitness team</Text>
      </View>

      <TextInput
        className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-4"
        placeholder="Team name"
        placeholderTextColor="#6b7280"
        value={teamName}
        onChangeText={setTeamName}
      />

      <TouchableOpacity
        onPress={handleCreate}
        className="bg-green-500 rounded-2xl py-4 items-center"
      >
        <Text className="text-black font-bold text-base">Create Team</Text>
      </TouchableOpacity>
    </View>
  );
}