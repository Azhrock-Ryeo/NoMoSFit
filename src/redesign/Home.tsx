/** @jsxImportSource react */
/*
 * Home answers one question first: "what am I training today?"
 *
 *   1. This week at a glance.
 *   2. UP NEXT: the routine you have gone longest without training
 *      (or the workout in progress), with one big Start button.
 *   3. Your other routines: tap a row for its progress, tap START to train.
 *   4. Your last completed workout.
 *
 * Editing and removing routines live on the Programs tab, so nothing
 * destructive sits beside a Start button.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../store/authStore';
import { useProgramStore } from '../store/programStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import type { WorkoutProgram } from '../types/program';
import { Button, common, Heading, IconButton, Notice, Screen, T } from './ui';
import { colors, fonts } from './tokens';
import { formatTime, normalizeSettings } from './model';
import { useProgramSettings } from './preferences';
import { historyDate, sessionStats } from './historyModel';
import { startProgram } from './startWorkout';
import { StarterRoutines, useStarterOffer } from './starters';
import type { RootRoutes, Tabs } from './routes';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfDay(time: number) { const d = new Date(time); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function mondayOf(time: number) { const d = new Date(time); return startOfDay(time) - (d.getDay() === 0 ? 6 : d.getDay() - 1) * DAY; }

/** "today", "yesterday", "3 days ago", then a date. */
function ago(time: number, now: number) {
  const days = Math.round((startOfDay(now) - startOfDay(time)) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return historyDate(time);
}

function greeting(now: number) {
  const hour = new Date(now).getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function SmallButton({ title, label, onPress }: { title: string; label: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  // Static style arrays only: NativeWind v4 may swallow Pressable style callbacks.
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={[s.smallButton, pressed && { opacity: .6 }]}>
    <Ionicons name="play" size={14} color={colors.green} /><T style={s.smallButtonText}>{title}</T>
  </Pressable>;
}

export function HomeScreen({ navigation }: BottomTabScreenProps<Tabs, 'Home'>) {
  const root = useNavigation<NativeStackNavigationProp<RootRoutes>>();
  const user = useAuthStore(state => state.user);
  const uid = user?.uid;
  const programOwner = useProgramStore(state => state.ownerUid);
  const allPrograms = useProgramStore(state => state.programs);
  const loading = useProgramStore(state => state.isLoading);
  const error = useProgramStore(state => state.error);
  const historyOwner = useWorkoutHistoryStore(state => state.ownerUid);
  const allSessions = useWorkoutHistoryStore(state => state.sessions);
  const preferences = useProgramSettings(state => state.values);
  const preferencesError = useProgramSettings(state => state.error);
  const active = useWorkoutStore(state => state.workout);
  const programs = programOwner === uid && uid ? allPrograms : [];
  const sessions = historyOwner === uid && uid ? allSessions : [];
  const now = Date.now();

  const view = useMemo(() => {
    const lastTrained = new Map<string, number>();
    for (const session of sessions) lastTrained.set(session.programId, Math.max(lastTrained.get(session.programId) ?? 0, session.finishedAt));
    // Longest since training comes first; never-trained routines lead, oldest created first.
    const ordered = [...programs].sort((a, b) =>
      (lastTrained.get(a.id) ?? 0) - (lastTrained.get(b.id) ?? 0) || a.createdAt - b.createdAt);
    const monday = mondayOf(now);
    const trainedDays = WEEKDAYS.map((_, index) => sessions.some(session => {
      const day = startOfDay(session.finishedAt); return day === monday + index * DAY;
    }));
    const thisWeek = sessions.filter(session => session.finishedAt >= monday).length;
    const latest = [...sessions].sort((a, b) => b.finishedAt - a.finishedAt)[0];
    return { lastTrained, ordered, trainedDays, thisWeek, latest, today: Math.round((startOfDay(now) - monday) / DAY) };
  }, [programs, sessions, now]);

  const name = (user?.displayName ?? user?.email?.split('@')[0] ?? '').trim().split(/\s+/)[0];
  const meta = (program: WorkoutProgram) => {
    const settings = normalizeSettings(preferences[program.id]);
    return `${program.exercises.length} ${program.exercises.length === 1 ? 'exercise' : 'exercises'} · ${program.exercises.reduce((n, e) => n + e.sets, 0)} sets · ${formatTime(settings.restSeconds)} rest`;
  };
  const trained = (program: WorkoutProgram) => {
    const time = view.lastTrained.get(program.id);
    return time ? `Last trained ${ago(time, now)}` : 'Not trained yet';
  };
  const openProgress = (program: WorkoutProgram) => navigation.navigate('History', { screen: 'ProgramHistory', params: { programId: program.id } });
  const create = () => navigation.navigate('Programs', { screen: 'ProgramEditor', params: {} });
  const [upNext, ...others] = view.ordered;
  const offerStarters = useStarterOffer(!loading && !error && programOwner === uid && !!uid && programs.length === 0);
  const resumeProgram = active ? programs.find(program => program.id === active.programId) : undefined;

  return <Screen bottomInset={false} contentStyle={{ paddingHorizontal: 24 }}>
    <T style={s.greeting}>{greeting(now)}{name ? `, ${name}` : ''}</T>
    <Heading title="QUICK START" right={<IconButton icon="add-circle" label="Create workout" color={colors.green} onPress={create} />} />

    <View style={[common.panel, s.week]}>
      <View style={s.weekDays}>
        {WEEKDAYS.map((letter, index) => <View key={index} style={s.day}>
          <View style={[s.dayDot, view.trainedDays[index] && s.dayDone, index === view.today && !view.trainedDays[index] && s.dayToday]}>
            {view.trainedDays[index] ? <Ionicons name="checkmark" size={14} color={colors.background} /> : null}
          </View>
          <T style={[s.dayLetter, index === view.today && { color: colors.white }]}>{letter}</T>
        </View>)}
      </View>
      <T accessibilityLabel={`${view.thisWeek} workouts this week`} style={s.weekText}>{view.thisWeek} {view.thisWeek === 1 ? 'workout' : 'workouts'} this week</T>
    </View>

    {loading && !programs.length && <Notice message="Loading your routines…" />}
    {error && <Notice message={error} retry={() => { void useProgramStore.getState().loadPrograms(); }} />}
    {preferencesError && <Notice message={preferencesError} retry={() => { void useProgramSettings.getState().load(); }} />}

    {active ? <View style={s.hero}>
      <T style={s.heroLabel}>WORKOUT IN PROGRESS</T>
      <T numberOfLines={2} style={s.heroName}>{active.programName.toUpperCase()}</T>
      <T style={s.heroMeta}>{active.completedSets.length} sets done so far</T>
      <Button title="RESUME WORKOUT" onPress={() => root.navigate('Workout', { programId: active.programId })} style={{ marginTop: 16 }} />
    </View> : upNext ? <View style={s.hero}>
      <T style={s.heroLabel}>UP NEXT</T>
      <T numberOfLines={2} style={s.heroName}>{upNext.name.toUpperCase()}</T>
      <T style={s.heroMeta}>{meta(upNext)}</T>
      <T style={s.heroTrained}>{trained(upNext)}</T>
      <Button title="START WORKOUT" onPress={() => startProgram(upNext, root)} style={{ marginTop: 16 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={`See ${upNext.name} progress`} onPress={() => openProgress(upNext)} style={s.heroLink}>
        <T style={s.link}>View progress</T><Ionicons name="chevron-forward" size={16} color={colors.green} />
      </Pressable>
    </View> : null}

    {(active ? view.ordered.filter(program => program.id !== resumeProgram?.id) : others).length > 0 && <>
      <T style={s.section}>{active ? 'YOUR ROUTINES' : 'OTHER ROUTINES'}</T>
      {(active ? view.ordered.filter(program => program.id !== resumeProgram?.id) : others).map(program => <View key={program.id} style={[common.panel, s.row]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${program.name}. ${trained(program)}. Opens progress.`} onPress={() => openProgress(program)} style={s.rowInfo}>
          <T numberOfLines={1} style={s.rowName}>{program.name.toUpperCase()}</T>
          <T numberOfLines={1} style={s.rowMeta}>{trained(program)}</T>
        </Pressable>
        <SmallButton title="START" label={`Start ${program.name}`} onPress={() => startProgram(program, root)} />
      </View>)}
    </>}

    {!loading && !error && !programs.length && <View style={[common.panel, s.empty]}>
      <Ionicons name="barbell-outline" size={30} color={colors.green} />
      <T style={s.emptyTitle}>BUILD YOUR FIRST ROUTINE</T>
      <T style={s.emptyText}>Add the exercises you train and it will be ready here in one tap.</T>
      <Button title="CREATE WORKOUT" onPress={create} style={{ marginTop: 16 }} />
    </View>}
    {offerStarters && <StarterRoutines />}

    {view.latest && <>
      <T style={s.section}>LAST WORKOUT</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`View last workout, ${view.latest.programName}`}
        onPress={() => navigation.navigate('History', { screen: 'SessionDetail', params: { sessionId: view.latest.id } })} style={[common.panel, s.row]}>
        <View style={s.rowInfo}>
          <T numberOfLines={1} style={s.rowName}>{view.latest.programName.toUpperCase()}</T>
          <T numberOfLines={1} style={s.rowMeta}>{ago(view.latest.finishedAt, now)} · {sessionStats(view.latest).sets} sets · {sessionStats(view.latest).reps} reps · {formatTime(view.latest.durationSeconds)}</T>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
    </>}
    <View style={{ height: 12 }} />
  </Screen>;
}

const s = StyleSheet.create({
  greeting: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  week: { paddingVertical: 14 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6, flex: 1 },
  dayDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dayDone: { backgroundColor: colors.green, borderColor: colors.green },
  dayToday: { borderColor: colors.green },
  dayLetter: { fontSize: 12, color: colors.faint },
  weekText: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 12 },
  hero: { borderWidth: 2, borderColor: colors.green, backgroundColor: '#10231A', borderRadius: 18, padding: 18, marginTop: 14 },
  heroLabel: { fontSize: 12, color: colors.green, letterSpacing: 1 },
  heroName: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, marginTop: 8 },
  heroMeta: { fontSize: 13, color: colors.muted, marginTop: 8 },
  heroTrained: { fontSize: 13, color: colors.white, marginTop: 4 },
  heroLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, marginBottom: -8 },
  link: { fontSize: 14, color: colors.green },
  section: { fontSize: 12, color: colors.muted, letterSpacing: 1, marginTop: 26, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 10 },
  rowInfo: { flex: 1, minHeight: 44, justifyContent: 'center' },
  rowName: { fontFamily: fonts.heading, fontSize: 15 },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  smallButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.green, backgroundColor: '#10231A' },
  smallButtonText: { fontFamily: fonts.heading, fontSize: 13, color: colors.green },
  empty: { alignItems: 'center', marginTop: 14, paddingVertical: 24 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 16, marginTop: 12 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginTop: 8 },
});
