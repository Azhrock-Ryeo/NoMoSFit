import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';

interface WorkoutSession {
  id: string;
  workoutName: string;
  durationSeconds: number;
  endedAt: string;
  exerciseLogs: any[];
}

export default function HistoryScreen() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const { db } = await import('../../config/firebase');
      const q = query(
        collection(db, 'workoutSessions'),
        where('uid', '==', user.uid),
        orderBy('endedAt', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WorkoutSession[];
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}m`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
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
              <Text className="text-gray-500 text-xs mt-2">
                {session.exerciseLogs?.length || 0} exercises
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}