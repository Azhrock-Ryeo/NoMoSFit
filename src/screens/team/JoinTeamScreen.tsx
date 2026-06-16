import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function JoinTeamScreen() {
  const navigation = useNavigation<any>();
  const [code, setCode] = useState('');

  const handleJoin = () => {
    if (!code.trim()) return Alert.alert('Enter an invite code');
    Alert.alert('Coming Soon', 'Team joining will be available in Phase 4');
  };

  return (
    <View className="flex-1 bg-black px-6">
      <View className="pt-14 pb-6">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mb-4">
          <Text className="text-green-400">← Back</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Join Team</Text>
        <Text className="text-gray-400 text-sm mt-1">Enter your invite code</Text>
      </View>

      <TextInput
        className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-4 text-center text-2xl tracking-widest"
        placeholder="XXXXXX"
        placeholderTextColor="#6b7280"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        maxLength={6}
      />

      <TouchableOpacity
        onPress={handleJoin}
        className="bg-green-500 rounded-2xl py-4 items-center"
      >
        <Text className="text-black font-bold text-base">Join Team</Text>
      </TouchableOpacity>
    </View>
  );
}