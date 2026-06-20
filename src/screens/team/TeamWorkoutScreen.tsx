import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { listenToTeamMembers, updateMyStatus, clearMyStatus, TeamMemberStatus } from '../../services/TeamService';

const DEMO_TEAM_ID = 'demo_team_001';

export default function TeamWorkoutScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<TeamMemberStatus[]>([]);
  const [isWorkingOut, setIsWorkingOut] = useState(false);

  useEffect(() => {
    const unsubscribe = listenToTeamMembers(DEMO_TEAM_ID, (data) => {
      setMembers(data);
    });
    return () => unsubscribe();
  }, []);

  const handleStartTeamWorkout = async () => {
    if (!user) return;
    setIsWorkingOut(true);
    await updateMyStatus(DEMO_TEAM_ID, user.uid, user.displayName || 'Member', {
      isWorkingOut: true,
      currentExercise: 'Starting workout...',
    });
  };

  const handleStopTeamWorkout = async () => {
    if (!user) return;
    setIsWorkingOut(false);
    await clearMyStatus(DEMO_TEAM_ID, user.uid);
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '';
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    return `${mins}m ago`;
  };

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">Team</Text>
        <Text className="text-gray-400 text-sm mt-1">Train together — live</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* My Status */}
        <View className="bg-gray-900 rounded-2xl p-4 mb-4">
          <Text className="text-white font-bold mb-3">My Status</Text>
          {isWorkingOut ? (
            <>
              <View className="flex-row items-center mb-3">
                <View className="w-3 h-3 rounded-full bg-green-400 mr-2" />
                <Text className="text-green-400 font-bold">Currently Working Out</Text>
              </View>
              <TouchableOpacity
                onPress={handleStopTeamWorkout}
                className="bg-red-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-bold">Stop & Go Offline</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View className="flex-row items-center mb-3">
                <View className="w-3 h-3 rounded-full bg-gray-500 mr-2" />
                <Text className="text-gray-400">Not working out</Text>
              </View>
              <TouchableOpacity
                onPress={handleStartTeamWorkout}
                className="bg-green-500 rounded-xl py-3 items-center"
              >
                <Text className="text-black font-bold">Go Live with Team</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Live Members */}
        <Text className="text-white font-bold mb-3">
          Team Members ({members.filter(m => m.isWorkingOut).length} active)
        </Text>

        {members.length === 0 ? (
          <View className="bg-gray-900 rounded-2xl p-5 items-center">
            <Text className="text-4xl mb-3">👥</Text>
            <Text className="text-white font-bold">No members online</Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">
              Start your workout to appear here!
            </Text>
          </View>
        ) : (
          members.map((member) => (
            <View key={member.uid} className="bg-gray-900 rounded-2xl p-4 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className={`w-3 h-3 rounded-full mr-3 ${member.isWorkingOut ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <Text className="text-white font-bold">{member.displayName || member.uid}</Text>
                </View>
                <Text className="text-gray-500 text-xs">{formatTime(member.startedAt)}</Text>
              </View>
              {member.isWorkingOut && member.currentExercise ? (
                <Text className="text-green-400 text-sm mt-2 ml-6">{member.currentExercise}</Text>
              ) : (
                <Text className="text-gray-600 text-sm mt-2 ml-6">Resting</Text>
              )}
            </View>
          ))
        )}

        <View className="h-6" />

        <TouchableOpacity
          onPress={() => navigation.navigate('CreateTeam')}
          className="bg-gray-900 rounded-2xl py-4 items-center mb-3"
        >
          <Text className="text-white font-semibold text-base">+ Create a Team</Text>
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