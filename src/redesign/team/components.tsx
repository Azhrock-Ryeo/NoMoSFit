/** @jsxImportSource react */
import { T as Text } from '../ui';
import { memo } from 'react';
import { ActivityIndicator, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TeamMember } from '../../types/team';
import type { TeamWorkoutActivity } from '../../types/teamActivity';
import { colors, fonts } from '../tokens';
import { Button } from '../ui';
import { duration, quantity, workoutDate, type Problem, type WeeklySummary } from './model';

export function Notice({ problem, retry, busy = false }: { problem: Problem; retry: () => void; busy?: boolean }) {
  const openIndex = async () => {
    if (!problem.indexUrl) return;
    try { await Linking.openURL(problem.indexUrl); } catch { /* Instructions remain visible if no browser is available. */ }
  };
  return <View style={s.notice} accessibilityLiveRegion="polite">
    <Text style={s.noticeTitle}>{problem.title}</Text>
    <Text style={s.body}>{problem.message}</Text>
    <Text selectable style={s.code}>Code: {problem.code}</Text>
    {problem.indexUrl ? <TouchableOpacity accessibilityRole="button" onPress={() => { void openIndex(); }} style={s.link}>
      <Text style={s.linkText}>Open Firebase index setup (owner)</Text>
    </TouchableOpacity> : null}
    <Button title="Retry" onPress={retry} disabled={busy} secondary style={{ marginTop: 8 }} />
  </View>;
}
export function Metric({ value, label }: { value: string; label: string }) {
  return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>;
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <View style={[s.avatar, large && s.avatarLarge]}><Text style={[s.initial, large && { fontSize: 28 }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text></View>;
}
export const MemberRow = memo(function MemberRow({ member, viewerUid, weekly, onOpen }: {
  member: TeamMember; viewerUid: string; weekly: WeeklySummary | null; onOpen: (member: TeamMember) => void;
}) {
  const stats = weekly?.members[member.uid];
  return <TouchableOpacity activeOpacity={0.8} accessibilityRole="button"
    accessibilityLabel={`View ${member.displayName}'s shared workout history`}
    accessibilityHint="Opens only workouts shared with this team"
    onPress={() => onOpen(member)} style={s.member}>
    <Avatar name={member.displayName} />
    <View style={s.memberInfo}>
      <View style={s.nameRow}><Text style={s.memberName} numberOfLines={2}>{member.displayName}{member.uid === viewerUid ? ' (You)' : ''}</Text>
        {member.role === 'owner' ? <Text style={s.badge}>OWNER</Text> : null}</View>
      <Text style={s.small}>{weekly ? `${stats?.workouts ?? 0} workouts this week${stats ? ` · ${quantity(stats.volume)} kg volume` : ''}` : 'Weekly totals unavailable'}</Text>
      <Text style={s.linkText}>View shared workouts</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.green} />
  </TouchableOpacity>;
});
export const WorkoutRow = memo(function WorkoutRow({ item }: { item: TeamWorkoutActivity }) {
  return <View style={s.workout}>
    <View style={s.nameRow}><Ionicons name="barbell-outline" color={colors.green} size={22} />
      <Text style={s.workoutName}>{item.programName}</Text></View>
    <Text style={s.small}>{workoutDate(item.finishedAt)}</Text>
    <View style={s.metrics}>
      <Metric value={String(item.totalSets)} label="SETS" />
      <Metric value={String(item.totalReps)} label="REPS" />
      <Metric value={quantity(item.totalVolume)} label="KG VOLUME" />
    </View>
    <View style={s.duration}><Ionicons name="time-outline" size={15} color={colors.muted} />
      <Text style={s.small}>Duration {duration(item.durationSeconds)}</Text></View>
  </View>;
});
export function Loading({ text }: { text: string }) {
  return <View style={s.loading}><ActivityIndicator color={colors.green} /><Text style={s.body}>{text}</Text></View>;
}
export const teamStyles = StyleSheet.create({
  flex: { flex: 1 }, page: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 14, gap: 10 },
  title: { color: colors.white, fontSize: 23, fontFamily: fonts.heading, flex: 1 },
  heading: { color: colors.white, fontSize: 18, fontFamily: fonts.heading },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
  subheading: { color: colors.white, fontSize: 16, fontFamily: fonts.heading, marginTop: 10, marginBottom: 6 },
  metrics: { flexDirection: 'row', gap: 4, marginVertical: 12 },
  green: { color: colors.green },
  muted: { color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 14 },
  profile: { alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 24 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  search: { backgroundColor: colors.panel, color: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    minHeight: 48, paddingHorizontal: 14, marginTop: 8, marginBottom: 14 },
  footer: { paddingTop: 8, paddingBottom: 24, gap: 10 },
  footerText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
const s = StyleSheet.create({
  notice: { backgroundColor: '#2C2021', borderColor: '#83424A', borderWidth: 1, borderRadius: 14, padding: 14, gap: 8, marginBottom: 14 },
  noticeTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  code: { color: colors.muted, fontSize: 11 },
  link: { paddingVertical: 12 }, linkText: { color: colors.green, fontSize: 12, fontWeight: '600', lineHeight: 20 },
  metric: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  metricValue: { color: colors.white, fontSize: 17, fontWeight: '700', flexWrap: 'wrap' },
  metricLabel: { color: colors.muted, fontSize: 9, letterSpacing: 0.6, marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#073219', alignItems: 'center', justifyContent: 'center' },
  avatarLarge: { width: 76, height: 76, borderRadius: 24 }, initial: { color: colors.green, fontSize: 20, fontWeight: '800' },
  member: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, minHeight: 104 },
  memberInfo: { flex: 1, gap: 5 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { color: colors.white, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  badge: { color: colors.green, fontSize: 9, fontWeight: '700', backgroundColor: '#073219', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  workout: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 8, marginBottom: 12 },
  workoutName: { color: colors.white, fontSize: 17, fontWeight: '700', flex: 1 }, metrics: { flexDirection: 'row', marginVertical: 8, gap: 6 },
  duration: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  loading: { paddingVertical: 26, alignItems: 'center', gap: 12 },
});
