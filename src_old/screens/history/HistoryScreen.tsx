import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { database } from '../../lib/database';

interface LocalSession {
  id: string;
  workoutName: string;
  durationSeconds: number;
  endedAt: number;
  syncStatus: string;
}

export default function HistoryScreen() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const sessionsCollection = database.get('workout_sessions');
      const allSessions = await sessionsCollection.query().fetch();

      const mapped = allSessions
        .map((s: any) => ({
          id: s.id,
          workoutName: s.workoutName,
          durationSeconds: s.durationSeconds,
          endedAt: s.endedAt,
          syncStatus: s.syncStatus,
        }))
        .sort((a, b) => b.endedAt - a.endedAt);

      setSessions(mapped);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">History</Text>
        <Text className="text-gray-400 text-sm mt-1">Your past workouts</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4ade80" className="mt-10" />
      ) : sessions.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 text-base">No workouts yet.</Text>
          <Text className="text-gray-600 text-sm mt-1">Complete your first workout!</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6">
          {sessions.map((session) => (
            <View key={session.id} className="bg-gray-900 rounded-2xl p-5 mb-3">
              <View className="flex-row justify-between items-start">
                <Text className="text-white font-bold text-lg">{session.workoutName}</Text>
                <Text className="text-green-400 font-bold">{formatDuration(session.durationSeconds)}</Text>
              </View>
              <Text className="text-gray-400 text-sm mt-1">{formatDate(session.endedAt)}</Text>
              <View className="flex-row items-center mt-2">
                <View className={`w-2 h-2 rounded-full mr-2 ${session.syncStatus === 'synced' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <Text className="text-gray-500 text-xs">
                  {session.syncStatus === 'synced' ? 'Synced to cloud' : 'Pending sync'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}