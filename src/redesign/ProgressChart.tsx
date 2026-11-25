/** @jsxImportSource react */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSession } from '../types/history';
import { T } from './ui';
import { colors, fonts } from './tokens';
import { compactNumber } from './historyModel';
import { buildTrend, exerciseOptions, trendChange, type TrendMetric, type TrendRange } from './progressModel';
const ranges: Array<{ key: TrendRange; label: string }> = [{ key: 'WEEKS', label: '8 weeks' }, { key: 'MONTHS', label: '6 months' }, { key: 'YEAR', label: '1 year' }];
export function ProgressChart({ sessions, title = 'YOUR PROGRESS' }: { sessions: WorkoutSession[]; title?: string }) {
  const [range, setRange] = useState<TrendRange>('WEEKS');
  const [metric, setMetric] = useState<TrendMetric>('reps');
  const [exercise, setExercise] = useState<string | undefined>();
  const [selected, setSelected] = useState<number | null>(null);
  const options = useMemo(() => exerciseOptions(sessions), [sessions]);
  const resolvedExercise = options.some(o => o.id === exercise) ? exercise : undefined;
  const resolvedMetric = !resolvedExercise && metric === 'weight' ? 'reps' : metric;
  const buckets = useMemo(() => buildTrend(sessions, range, Date.now(), resolvedExercise), [sessions, range, resolvedExercise]);
  const active = buckets.find(b => b.start === selected) ?? buckets[buckets.length - 1];
  const max = Math.max(1, ...buckets.map(b => b[resolvedMetric]));
  const change = trendChange(buckets, resolvedMetric);
  const name = { workouts: 'Workouts', reps: 'Actual reps', volume: 'Volume (kg·reps)', weight: 'Best weight (kg)' }[resolvedMetric];
  const metrics: Array<{ key: TrendMetric; label: string }> = [{ key: 'workouts', label: 'Workouts' }, { key: 'reps', label: 'Reps' }, { key: 'volume', label: 'Volume' }, ...(resolvedExercise ? [{ key: 'weight' as const, label: 'Best kg' }] : [])];
  return <View style={s.panel}>
    <View style={s.heading}><Ionicons name="stats-chart-outline" size={20} color={colors.green} /><T style={s.title}>{title}</T></View>
    <View style={s.options}>{ranges.map(r => <Pressable key={r.key} accessibilityRole="button" accessibilityState={{ selected: range === r.key }} onPress={() => { setRange(r.key); setSelected(null); }} style={[s.chip, range === r.key && s.chipActive]}><T style={s.chipText}>{r.label}</T></Pressable>)}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.options}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: !resolvedExercise }} onPress={() => { setExercise(undefined); setSelected(null); }} style={[s.chip, !resolvedExercise && s.chipActive]}><T style={s.chipText}>All exercises</T></Pressable>
      {options.map((e, index) => <Pressable key={e.id} accessibilityRole="button" accessibilityState={{ selected: e.id === resolvedExercise }} onPress={() => { setExercise(e.id); setSelected(null); }} style={[s.chip, resolvedExercise === e.id && s.chipActive]}><T style={s.chipText}>{e.name}{options.filter(x => x.name === e.name).length > 1 ? ` (${index + 1})` : ''}</T></Pressable>)}
    </ScrollView>
    <View style={s.options}>{metrics.map(m => <Pressable key={m.key} accessibilityRole="button" accessibilityState={{ selected: resolvedMetric === m.key }} onPress={() => setMetric(m.key)} style={[s.chip, resolvedMetric === m.key && s.chipActive]}><T style={s.chipText}>{m.label}</T></Pressable>)}</View>
    <T style={s.caption}>{name} · {range === 'WEEKS' ? 'weekly' : 'monthly'} {resolvedMetric === 'weight' ? 'maximum' : 'totals'}</T>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bars}>
      {buckets.map(b => <Pressable key={b.start} accessibilityRole="button" accessibilityLabel={`${b.fullLabel}: ${b[resolvedMetric]} ${name}${b.partial ? ', current incomplete period' : ''}`} accessibilityState={{ selected: active.start === b.start }} onPress={() => setSelected(b.start)} style={s.barHit}>
        <T style={s.barValue}>{compactNumber(b[resolvedMetric])}</T>
        <View style={s.track}><View style={[s.bar, { height: b[resolvedMetric] > 0 ? Math.max(3, b[resolvedMetric] / max * 96) : 0, opacity: b.partial ? .6 : 1 }, active.start === b.start && s.barSelected]} /></View>
        <T style={s.barDate}>{b.label}</T>
      </Pressable>)}
    </ScrollView>
    <View accessibilityLiveRegion="polite" style={s.detail}><T style={s.value}>{compactNumber(active[resolvedMetric])} <T style={s.caption}>{name.toLowerCase()}</T></T><T style={s.caption}>{active.fullLabel}{active.partial ? ' · in progress' : ''} · {active.workouts} workouts · {active.sets} sets</T></View>
    {change ? <T style={s.caption}>Last two completed periods: {compactNumber(change.before)} → {compactNumber(change.after)} ({change.delta > 0 ? '+' : change.delta < 0 ? '−' : ''}{compactNumber(Math.abs(change.delta))}).</T> : <T style={s.caption}>A comparison appears after two completed periods with logged workouts.</T>}
    <T style={s.footnote}>Only saved results are plotted. No recorded sessions means zero logged activity, not lost fitness. Volume = actual reps × kg; it is training volume, not a strength score. Choose one exercise for best-weight comparisons.</T>
  </View>;
}
const s = StyleSheet.create({
  panel: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }, title: { fontFamily: fonts.heading, fontSize: 14, flex: 1 },
  options: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingBottom: 10 }, chip: { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center', backgroundColor: '#22232D', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.green, backgroundColor: '#10311D' }, chipText: { fontSize: 12 }, caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  bars: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 12 }, barHit: { width: 46, alignItems: 'center' }, barValue: { fontSize: 11, color: colors.muted, paddingBottom: 4 },
  track: { height: 96, width: 20, justifyContent: 'flex-end', backgroundColor: '#232530', borderRadius: 5, overflow: 'hidden' }, bar: { width: '100%', backgroundColor: colors.greenDark }, barSelected: { backgroundColor: colors.green }, barDate: { fontSize: 11, color: colors.muted, marginTop: 7, textAlign: 'center' },
  detail: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, paddingBottom: 10, gap: 4 }, value: { fontSize: 23, fontWeight: '700', color: colors.green }, footnote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
