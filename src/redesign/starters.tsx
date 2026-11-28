/** @jsxImportSource react */
/*
 * Starter routines for someone with nothing set up yet.
 * Adding one creates an ordinary routine: it can be edited or
 * removed like any other, and syncs the same way.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../config/firebase';
import { useProgramStore } from '../store/programStore';
import type { WorkoutCategory } from '../types/program';
import { common, T } from './ui';
import { colors, fonts } from './tokens';
import { createId, PRESETS } from './model';
import { useProgramSettings } from './preferences';
import { AppAlert } from './feedback';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { relinkToHistory } from './relink';

const STARTERS: Array<{ name: string; category: WorkoutCategory; exercises: string[] }> = [
  { name: 'PUSH DAY', category: 'PUSH', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Triceps Pushdown'] },
  { name: 'PULL DAY', category: 'PULL', exercises: ['Lat Pulldown', 'Barbell Row', 'Seated Cable Row', 'Face Pull', 'Barbell Curl'] },
  { name: 'LEG DAY', category: 'LEGS', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise'] },
  { name: 'FULL BODY', category: 'FULL BODY', exercises: ['Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Plank'] },
];
const MODE = 'HYPERTROPHY' as const;

/**
 * Offer templates when there are no routines, and keep the list on screen
 * for the rest of that visit so several can be added in a row.
 */
export function useStarterOffer(isEmpty: boolean) {
  const [offer, setOffer] = useState(false);
  useEffect(() => { if (isEmpty) setOffer(true); }, [isEmpty]);
  useFocusEffect(useCallback(() => () => setOffer(false), []));
  return offer || isEmpty;
}

export function StarterRoutines() {
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const locked = useRef(false);
  const add = async (starter: typeof STARTERS[number]) => {
    if (locked.current || added.includes(starter.name)) return;
    const owner = auth.currentUser?.uid;
    if (!owner) return;
    locked.current = true; setBusy(starter.name);
    try {
      // If this name still has History from a removed routine, continue it.
      const history = useWorkoutHistoryStore.getState();
      const link = relinkToHistory(starter.name,
        starter.exercises.map(name => ({ id: createId('exercise'), name, sets: 3, targetReps: PRESETS[MODE].target })),
        history.ownerUid === owner ? history.sessions : [], useProgramStore.getState().programs);
      const program = await useProgramStore.getState().addProgram({
        id: link.programId ?? createId(), name: starter.name, category: starter.category, targetMuscles: [], exercises: link.exercises,
      });
      if (auth.currentUser?.uid !== owner) return;
      await useProgramSettings.getState().save(program.id, { mode: MODE, restSeconds: PRESETS[MODE].defaultRestSeconds, initialWeights: {} });
      setAdded(list => [...list, starter.name]);
    } catch (error) {
      AppAlert.alert('Could not add routine', error instanceof Error ? error.message : 'Please try again.');
    } finally { locked.current = false; setBusy(null); }
  };
  return <View>
    <T style={s.section}>OR START FROM A TEMPLATE</T>
    {STARTERS.map(starter => {
      const done = added.includes(starter.name);
      return <View key={starter.name} style={[common.panel, s.row]}>
        <View style={{ flex: 1 }}>
          <T style={s.name}>{starter.name}</T>
          <T numberOfLines={2} style={s.meta}>{starter.exercises.join(' · ')}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={done ? `${starter.name} added` : `Add ${starter.name}`} accessibilityState={{ disabled: done || !!busy }}
          disabled={done || !!busy} onPress={() => { void add(starter); }} style={[s.add, done && s.added, busy === starter.name && { opacity: .5 }]}>
          <Ionicons name={done ? 'checkmark' : 'add'} size={16} color={done ? colors.muted : colors.green} />
          <T style={[s.addText, done && { color: colors.muted }]}>{done ? 'ADDED' : 'ADD'}</T>
        </Pressable>
      </View>;
    })}
    <T style={s.note}>3 sets of 6–12 reps with 2:00 rest. Change anything later on the Programs tab.</T>
  </View>;
}

const s = StyleSheet.create({
  section: { fontSize: 12, color: colors.muted, letterSpacing: 1, marginTop: 26, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, marginBottom: 10 },
  name: { fontFamily: fonts.heading, fontSize: 15 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  add: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.green, backgroundColor: '#10231A' },
  added: { borderColor: colors.border, backgroundColor: 'transparent' },
  addText: { fontFamily: fonts.heading, fontSize: 13, color: colors.green },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 2 },
});
