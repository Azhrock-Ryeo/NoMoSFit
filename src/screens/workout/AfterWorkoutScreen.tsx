import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, addDoc } from 'firebase/firestore';
import { useWorkoutStore } from '../../store/workoutStore';
import { useAuthStore } from '../../store/authStore';
import { database } from '../../lib/database';

export default function AfterWorkoutScreen() {
  const navigation = useNavigation<any>();
  const { workoutName, exercises, exerciseLogs, startedAt, resetWorkout } = useWorkoutStore();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'pending' | 'synced' | 'failed'>('pending');

  const duration = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    : 0;

  const totalSets = exerciseLogs.reduce((acc, e) => acc + e.sets.length, 0);

  useEffect(() => {
    saveWorkout();
  }, []);

  const saveWorkout = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Step 1 — Save to WatermelonDB first (offline-first)
      const sessionsCollection = database.get('workout_sessions');
      const setLogsCollection = database.get('set_logs');

      let localSessionId = '';

      await database.write(async () => {
        const session = await sessionsCollection.create((record: any) => {
          record.workoutId = 'manual';
          record.workoutName = workoutName;
          record.startedAt = startedAt ? new Date(startedAt).getTime() : Date.now();
          record.endedAt = Date.now();
          record.durationSeconds = duration;
          record.wasCompleted = true;
          record.syncStatus = 'pending';
          record.firebaseId = '';
        });

        localSessionId = session.id;

        // Save all set logs
        for (const log of exerciseLogs) {
          for (const s of log.sets) {
            await setLogsCollection.create((record: any) => {
              record.sessionId = session.id;
              record.exerciseId = log.exerciseId || 'manual';
              record.exerciseName = log.exerciseName;
              record.setNumber = s.setNumber;
              record.targetReps = (s as any).targetReps ?? 0;
              record.achievedReps = s.achievedReps;
              record.weight = s.weight;
              record.completedAt = Date.now();
              record.syncStatus = 'pending';
            });
          }
        }
      });

      setSaved(true);
      setSyncStatus('pending');

      // Step 2 — Try to sync to Firestore immediately
      try {
        const { db } = await import('../../config/firebase');
        const docRef = await addDoc(collection(db, 'workoutSessions'), {
          uid: user.uid,
          workoutName,
          exercises,
          exerciseLogs,
          startedAt,
          endedAt: new Date().toISOString(),
          durationSeconds: duration,
          wasCompleted: true,
        });

        // Update sync status in WatermelonDB
        const session = await database.get('workout_sessions').find(localSessionId);
        await database.write(async () => {
          await (session as any).update((record: any) => {
            record.syncStatus = 'synced';
            record.firebaseId = docRef.id;
          });
        });

        setSyncStatus('synced');
      } catch (syncError) {
        // Firestore failed — data is safe in WatermelonDB, will sync later
        console.log('Firestore sync failed, will retry later:', syncError);
        setSyncStatus('failed');
      }

    } catch (e) {
      console.error('Save error:', e);
    }

    setSaving(false);
  };

  const handleDone = () => {
    resetWorkout();
    navigation.reset({ index: 0, routes: [{ name: 'BeforeWorkout' }] });
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-14 pb-4">
        <Text className="text-green-400 text-lg">Workout Complete! 🎉</Text>
        <Text className="text-white text-2xl font-bold">{workoutName}</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Summary */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-gray-900 rounded-2xl p-4 items-center">
            <Text className="text-green-400 text-xl font-bold">{formatTime(duration)}</Text>
            <Text className="text-gray-400 text-xs mt-1">Duration</Text>
          </View>
          <View className="flex-1 bg-gray-900 rounded-2xl p-4 items-center">
            <Text className="text-green-400 text-xl font-bold">{exercises.length}</Text>
            <Text className="text-gray-400 text-xs mt-1">Exercises</Text>
          </View>
          <View className="flex-1 bg-gray-900 rounded-2xl p-4 items-center">
            <Text className="text-green-400 text-xl font-bold">{totalSets}</Text>
            <Text className="text-gray-400 text-xs mt-1">Sets Done</Text>
          </View>
        </View>

        {/* Save Status */}
        <View className="bg-gray-900 rounded-2xl p-4 mb-4 flex-row items-center">
          {saving ? (
            <>
              <ActivityIndicator size="small" color="#4ade80" />
              <Text className="text-gray-400 ml-3">Saving workout...</Text>
            </>
          ) : saved ? (
            syncStatus === 'synced' ? (
              <Text className="text-green-400">✓ Saved locally + synced to cloud</Text>
            ) : syncStatus === 'failed' ? (
              <Text className="text-yellow-400">✓ Saved locally — will sync when online</Text>
            ) : (
              <Text className="text-blue-400">✓ Saved locally — syncing...</Text>
            )
          ) : (
            <Text className="text-red-400">Failed to save</Text>
          )}
        </View>

        {/* Exercise Breakdown */}
        <Text className="text-white font-bold mb-3">Exercise Breakdown</Text>
        {exerciseLogs.map((log, i) => (
          <View key={i} className="bg-gray-900 rounded-2xl p-4 mb-3">
            <Text className="text-white font-bold mb-2">{log.exerciseName}</Text>
            {log.sets.map((s, j) => (
              <View key={j} className="flex-row justify-between py-1 border-b border-gray-800">
                <Text className="text-gray-400">Set {s.setNumber}</Text>
                <Text className="text-white">{s.achievedReps} reps @ {s.weight}kg</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="px-6 pb-8 pt-2">
        <TouchableOpacity onPress={handleDone} className="bg-green-500 rounded-2xl py-4 items-center">
          <Text className="text-black font-bold text-lg">Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}