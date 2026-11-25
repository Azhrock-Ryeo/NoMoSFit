/** @jsxImportSource react */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { useAuthStore } from '../store/authStore';
import { Field, Heading, Notice, ProgressTable, Screen, SessionTable, T } from './ui';
import { colors, fonts } from './tokens';
import { formatTime, previousSession } from './model';
import { compactNumber, historyDate, historyGroups, historyTime, historyTotals, sessionStats } from './historyModel';
import { useReducedMotion } from './motion';
import { ProgressChart } from './ProgressChart';
import { useProgramStore } from '../store/programStore';
import { confirmRemoveRoutine } from './routineActions';
import type { HistoryProps } from './routes';

function useAccountHistory() {
  const uid = useAuthStore(s => s.user?.uid);
  const owner = useWorkoutHistoryStore(s => s.ownerUid);
  const sessions = useWorkoutHistoryStore(s => s.sessions);
  return useMemo(() => owner === uid && !!uid ? sessions : [], [uid, owner, sessions]);
}
function AnimatedHistoryCard({ children, onPress, label, index = 0 }: {
  children: React.ReactNode; onPress: () => void; label: string; index?: number;
}) {
  const enter = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { enter.setValue(1); press.setValue(1); return; }
    enter.setValue(0);
    const animation = Animated.timing(enter, { toValue: 1, duration: 240, delay: Math.min(index, 5) * 35, useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); press.stopAnimation(); };
  }, [reduced, index, enter, press]);
  const touch = (down: boolean) => {
    setPressed(down);
    if (reduced) return;
    Animated.spring(press, { toValue: down ? .985 : 1, useNativeDriver: true, speed: 35, bounciness: 0 }).start();
  };
  return <Animated.View style={{ marginBottom: 14, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: press }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens your recorded workout details"
      onPress={onPress} onPressIn={() => touch(true)} onPressOut={() => touch(false)} style={[s.card, pressed && s.cardPressed]}>
      {children}
    </Pressable>
  </Animated.View>;
}
function Metric({ value, label }: { value: string; label: string }) {
  return <View style={s.metric}><T style={s.metricValue}>{value}</T><T style={s.metricLabel}>{label}</T></View>;
}
function Totals({ sessions }: { sessions: ReturnType<typeof useAccountHistory> }) {
  const totals = historyTotals(sessions);
  return <View style={s.overview}>
    <Metric value={String(totals.workouts)} label="WORKOUTS" />
    <View style={s.separator} /><Metric value={String(totals.sets)} label="SETS LOGGED" />
    <View style={s.separator} /><Metric value={formatTime(totals.seconds)} label="TOTAL TIME" />
  </View>;
}
const reload = () => { void useWorkoutHistoryStore.getState().loadHistory(); };

export function HistoryScreen({ navigation }: HistoryProps<'HistoryList'>) {
  const sessions = useAccountHistory();
  const error = useWorkoutHistoryStore(s => s.error);
  const loading = useWorkoutHistoryStore(s => s.isLoading);
  const [search, setSearch] = useState('');
  const groups = useMemo(() => historyGroups(sessions, search), [sessions, search]);
  return <Screen bottomInset={false} scroll={false} contentStyle={{ paddingHorizontal: 24, paddingBottom: 0 }}>
    <FlatList data={groups} keyExtractor={group => group.id} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} colors={[colors.green]} />}
      ListHeaderComponent={<>
        <Heading title="HISTORY" right={<View style={s.iconBadge}><Ionicons name="time-outline" color={colors.green} size={22} /></View>} />
        <T style={s.subtitle}>Every session, saved. Choose a workout to see what changed.</T>
        <Totals sessions={sessions} />
        {!error && <ProgressChart sessions={sessions} />}
        <Field accessibilityLabel="Search workout history" icon="search-outline" placeholder="Search your workouts" value={search} onChangeText={setSearch} autoCorrect={false} />
        <View style={s.listHeader}><T style={s.sectionLabel}>YOUR WORKOUTS</T><T style={s.smallMuted}>{groups.length} {groups.length === 1 ? 'program' : 'programs'}</T></View>
        {error && <Notice message={error} retry={reload} />}
        {loading && !sessions.length && <Notice message="Loading your recorded sessions…" />}
      </>}
      ListEmptyComponent={!loading && !error ? <View style={s.empty}>
        <Ionicons name={search ? 'search-outline' : 'barbell-outline'} size={32} color={colors.green} />
        <T style={s.emptyTitle}>{search ? 'No matching workouts' : 'Your history starts here'}</T>
        <T style={s.emptyText}>{search ? 'Try a different name or clear the search.' : 'Finish a workout and it will appear here. Your results stay grouped by program.'}</T>
      </View> : null}
      renderItem={({ item: group, index }) => <AnimatedHistoryCard index={index}
        label={`${group.name}, ${group.sessions.length} completed workouts. Last trained ${historyDate(group.latest.finishedAt)}`}
        onPress={() => navigation.navigate('ProgramHistory', { programId: group.id })}>
        <View style={s.topRow}>
          <View style={s.programIcon}><Ionicons name="barbell-outline" size={24} color={colors.green} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><T style={s.cardTitle} numberOfLines={2}>{group.name.toUpperCase()}</T>
            <T style={s.cardSub}>{group.sessions.length} completed {group.sessions.length === 1 ? 'session' : 'sessions'}</T></View>
          <Ionicons name="chevron-forward" size={20} color={colors.green} />
        </View>
        <View style={s.divider} />
        <T style={s.latest}>LAST SESSION · {historyDate(group.latest.finishedAt)}</T>
        <View style={s.cardMetrics}>
          <Metric value={formatTime(group.latestStats.seconds)} label="DURATION" />
          <Metric value={String(group.latestStats.sets)} label="SETS" />
          <Metric value={String(group.latestStats.reps)} label="REPS" />
        </View>
        <View style={s.cardFooter}><T style={s.smallMuted}>{group.totalSets} sets logged in this program</T><T style={s.viewLabel}>VIEW HISTORY</T></View>
      </AnimatedHistoryCard>} />
  </Screen>;
}

export function ProgramHistoryScreen({ navigation, route }: HistoryProps<'ProgramHistory'>) {
  const sessions = useAccountHistory();
  const loading = useWorkoutHistoryStore(s => s.isLoading);
  const error = useWorkoutHistoryStore(s => s.error);
  const group = useMemo(() => historyGroups(sessions).find(g => g.id === route.params.programId), [sessions, route.params.programId]);
  const uid = useAuthStore(state => state.user?.uid);
  const routineOwner = useProgramStore(state => state.ownerUid);
  const routine = useProgramStore(state => state.programs.find(p => p.id === route.params.programId));
  const visibleRoutine = uid && routineOwner === uid ? routine : undefined;
  return <Screen bottomInset={false} scroll={false} contentStyle={{ paddingHorizontal: 24, paddingBottom: 0 }}>
    <FlatList data={group?.sessions ?? []} keyExtractor={session => session.id} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} colors={[colors.green]} />}
      ListHeaderComponent={<>
        <Heading title="HISTORY" onBack={() => navigation.goBack()} />
        <T style={s.programTitle}>{group?.name.toUpperCase() ?? 'WORKOUT HISTORY'}</T>
        <T style={s.subtitle}>Newest first. Open a session for sets, reps and comparison.</T>
        {group && <Totals sessions={group.sessions} />}
        {group && !error && <ProgressChart key={group.id} sessions={group.sessions} title="PROGRAM PROGRESS" />}
        {visibleRoutine ? <Pressable accessibilityRole="button" onPress={() => confirmRemoveRoutine(visibleRoutine)} style={{ minHeight: 44, justifyContent: 'center', marginBottom: 12 }}><T style={{ color: colors.red }}>Remove unused routine · keep ALL history</T></Pressable> : group ? <T style={{ color: colors.muted, marginBottom: 14 }}>This routine is no longer in Programs. All completed sessions below are preserved.</T> : null}
        {error && <Notice message={error} retry={reload} />}
      </>}
      ListEmptyComponent={!loading && !error ? <Notice message="No recorded sessions were found for this program." /> : null}
      renderItem={({ item: session, index }) => {
        const stats = sessionStats(session);
        const number = (group?.sessions.length ?? 0) - index;
        return <AnimatedHistoryCard index={index} onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
          label={`Session ${number}, ${historyDate(session.finishedAt)}, ${stats.sets} sets`}>
          <View style={s.topRow}><View style={{ flex: 1 }}><T style={s.cardTitle}>SESSION {number}</T><T style={s.cardSub}>{historyDate(session.finishedAt)} · {historyTime(session.finishedAt)}</T></View>
            {index === 0 && <View style={s.latestBadge}><T style={s.latestBadgeText}>LATEST</T></View>}<Ionicons name="chevron-forward" size={18} color={colors.green} /></View>
          <View style={s.divider} /><View style={s.cardMetrics}>
            <Metric value={formatTime(stats.seconds)} label="DURATION" /><Metric value={String(stats.sets)} label="SETS" /><Metric value={String(stats.reps)} label="REPS" />
          </View>
          <View style={s.cardFooter}><T style={s.smallMuted}>{stats.exercises} {stats.exercises === 1 ? 'exercise' : 'exercises'} · {compactNumber(stats.volume)} kg volume</T><T style={s.viewLabel}>DETAILS</T></View>
        </AnimatedHistoryCard>;
      }} />
  </Screen>;
}

export function SessionDetailScreen({ navigation, route }: HistoryProps<'SessionDetail'>) {
  const sessions = useAccountHistory();
  const current = sessions.find(session => session.id === route.params.sessionId);
  if (!current) return <Screen bottomInset={false}><Heading title="HISTORY" onBack={() => navigation.goBack()} /><Notice message="This session is no longer available." /></Screen>;
  const previous = previousSession(sessions, current);
  const stats = sessionStats(current);
  return <Screen bottomInset={false} contentStyle={{ paddingHorizontal: 24 }}>
    <Heading title="SESSION DETAILS" onBack={() => navigation.goBack()} />
    <T style={s.programTitle}>{current.programName.toUpperCase()}</T>
    <T style={s.subtitle}>{historyDate(current.finishedAt)} · {historyTime(current.finishedAt)}</T>
    <View style={s.overview}><Metric value={formatTime(stats.seconds)} label="DURATION" /><Metric value={String(stats.sets)} label="SETS" /><Metric value={String(stats.reps)} label="ACTUAL REPS" /></View>
    <T style={s.detailHeading}>THIS WORKOUT</T><SessionTable session={current} />
    <T style={s.detailHeading}>COMPARED WITH LAST TIME</T><ProgressTable current={current} previous={previous} />
    {previous && <><T style={s.detailHeading}>PREVIOUS WORKOUT</T><T style={s.previousDate}>{historyDate(previous.finishedAt)}</T><SessionTable session={previous} /></>}
    <View style={s.info}><Ionicons name="information-circle-outline" size={18} color={colors.muted} /><T style={s.infoText}>These are your recorded results. Changing a program’s preset does not rewrite completed workouts.</T></View>
  </Screen>;
}
const s = StyleSheet.create({
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginBottom: 20 },
  iconBadge: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#11291A', alignItems: 'center', justifyContent: 'center' },
  overview: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8, marginBottom: 20, backgroundColor: '#121820', borderRadius: 17, borderWidth: 1, borderColor: colors.border },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 }, metricValue: { color: colors.green, fontFamily: fonts.heading, fontSize: 14 }, metricLabel: { color: colors.muted, fontSize: 8, textAlign: 'center' },
  separator: { width: 1, height: 25, backgroundColor: colors.border },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26, marginBottom: 14, gap: 8 }, sectionLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1 },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, overflow: 'hidden' }, cardPressed: { borderColor: colors.green, backgroundColor: '#1D242A' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, programIcon: { width: 42, height: 42, backgroundColor: '#12321E', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 22 }, cardSub: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 4 }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  latest: { color: colors.muted, fontSize: 9, lineHeight: 15, marginBottom: 14 }, cardMetrics: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: colors.border, paddingTop: 13, gap: 10, flexWrap: 'wrap' }, smallMuted: { color: colors.muted, fontSize: 9, lineHeight: 15 }, viewLabel: { color: colors.green, fontSize: 9 },
  empty: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 24, alignItems: 'center', backgroundColor: colors.panel }, emptyTitle: { fontFamily: fonts.heading, marginTop: 14, fontSize: 15, textAlign: 'center' }, emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 19, fontSize: 12, marginTop: 10 },
  programTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 30, marginBottom: 8 }, latestBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#12321E' }, latestBadgeText: { color: colors.green, fontSize: 8 },
  detailHeading: { fontFamily: fonts.heading, fontSize: 13, marginTop: 26, marginBottom: 12 }, previousDate: { color: colors.muted, fontSize: 10, marginBottom: 10 },
  info: { flexDirection: 'row', gap: 9, marginTop: 24, padding: 14, backgroundColor: '#121820', borderRadius: 12 }, infoText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 17 },
});
