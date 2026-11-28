/** @jsxImportSource react */
import { T as Text } from '../ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Share, TextInput, View } from 'react-native';
import { AppAlert as Alert } from '../feedback';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { createTeam, joinTeam, leaveTeam } from '../../services/teamService';
import type { TeamMember } from '../../types/team';
import { AppBackground, Button, IconButton } from '../ui';
import { colors } from '../tokens';
import { useTeamOverview } from './hooks';
import { duration, orderMembers, quantity } from './model';
import { Loading, MemberRow, Metric, Notice, teamStyles as s } from './components';
import MemberHistory, { type MemberSelection } from './MemberHistory';

export default function TeamScreen() {
  const uid = useAuthStore(state => state.user?.uid);
  // Changing accounts unmounts all Team state, modal rows, pending UI requests and cursors.
  return uid ? <TeamContent key={uid} viewerUid={uid} /> : <AppBackground><Loading text="Sign in to view your team." /></AppBackground>;
}
function TeamContent({ viewerUid }: { viewerUid: string }) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const dashboard = useTeamOverview(viewerUid);
  const [selection, setSelection] = useState<MemberSelection | null>(null);
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const actionPending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const team = dashboard.overview?.team;
  useEffect(() => { if (!focused) setSelection(null); }, [focused]);
  useEffect(() => { setSelection(old => old && old.teamId !== team?.id ? null : old); }, [team?.id]);
  const members = useMemo(() => orderMembers(dashboard.overview?.members ?? [], dashboard.weekly), [dashboard.overview?.members, dashboard.weekly]);
  const refresh = useCallback(() => { if (!actionPending.current) void dashboard.refresh(); }, [dashboard.refresh]);
  const openMember = useCallback((member: TeamMember) => {
    if (team) setSelection({ viewerUid, teamId: team.id, memberUid: member.uid, member, teamName: team.name });
  }, [viewerUid, team]);
  const closeMember = useCallback(() => setSelection(null), []);

  const changeTeam = async (action: 'create' | 'join' | 'leave') => {
    if (actionPending.current || auth.currentUser?.uid !== viewerUid) return;
    if (action === 'create' && !name.trim()) { Alert.alert('Team name', 'Enter a name for your team.'); return; }
    if (action === 'join' && !/^[A-Z0-9]{6}$/.test(code.trim().toUpperCase())) { Alert.alert('Team code', 'Enter the six-character team invite code.'); return; }
    actionPending.current = true; setWorking(true);
    try {
      // Existing create/join/leave functions still perform the real Firestore operations.
      // Do not timeout writes and falsely claim they failed while Firebase might commit later.
      if (action === 'create') await createTeam(name.trim());
      else if (action === 'join') await joinTeam(code.trim().toUpperCase());
      else if (team) await leaveTeam(team.id);
      if (!mounted.current || auth.currentUser?.uid !== viewerUid) return;
      setMode('none'); setName(''); setCode(''); setSelection(null);
      await dashboard.refresh();
    } catch (failure) {
      if (mounted.current && auth.currentUser?.uid === viewerUid) Alert.alert('Team update failed', failure instanceof Error ? failure.message : 'Please check your connection and try again.');
    } finally {
      actionPending.current = false;
      if (mounted.current && auth.currentUser?.uid === viewerUid) setWorking(false);
    }
  };
  const confirmLeave = () => {
    if (!team || team.ownerId === viewerUid) return;
    Alert.alert('Leave team?', `Leave ${team.name}? Your private workout history will not be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave team', style: 'destructive', onPress: () => { void changeTeam('leave'); } },
    ]);
  };
  const shareCode = async () => {
    if (!team) return;
    try { await Share.share({ message: `Join ${team.name} in NoMoSFit. Team code: ${team.joinCode}` }); }
    catch { Alert.alert('Share code', 'Unable to open sharing. You can select and copy the team code below.'); }
  };
  const summary = dashboard.weekly;
  const blocked = working || dashboard.loading || dashboard.weekLoading;

  return <AppBackground>
    <View style={[s.header, s.page, { paddingTop: insets.top + 12 }]}>
      <Text style={s.title}>TEAM</Text>
      <IconButton icon="refresh" label="Refresh team" onPress={refresh} disabled={blocked} />
    </View>
    <FlatList<TeamMember> style={s.flex} data={members} keyExtractor={item => item.uid}
      renderItem={({ item }) => <MemberRow member={item} viewerUid={viewerUid} weekly={summary} onOpen={openMember} />}
      initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5}
      contentContainerStyle={[s.page, { paddingBottom: 24, flexGrow: 1 }]}
      refreshing={Boolean(dashboard.overview) && dashboard.loading} onRefresh={refresh}
      ListHeaderComponent={<>
        {dashboard.error ? <Notice problem={dashboard.error} retry={refresh} busy={blocked} /> : null}
        {dashboard.error && dashboard.overview ? <Text style={s.hint}>Showing the last loaded team overview. Pull down to retry.</Text> : null}
        {team ? <>
          <View style={s.panel}>
            <Text style={s.heading}>{team.name.toUpperCase()}</Text>
            <Text style={[s.body, { marginTop: 6 }]}>{members.length} {members.length === 1 ? 'member' : 'members'} · Train together</Text>
            <View style={[s.header, { paddingBottom: 0, marginTop: 12 }]}>
              <View style={s.flex}><Text style={s.hint}>INVITE CODE</Text><Text selectable style={[s.heading, s.green]}>{team.joinCode}</Text></View>
              <IconButton icon="share-outline" label="Share team invite code" onPress={() => { void shareCode(); }} />
            </View>
          </View>
          <View style={s.panel}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.subheading}>THIS WEEK</Text>{dashboard.weekLoading ? <ActivityIndicator color={colors.green} size="small" /> : null}
            </View>
            <View style={s.metrics}>
              <Metric value={summary ? String(summary.workouts) : '—'} label="WORKOUTS" />
              <Metric value={summary ? duration(summary.seconds) : '—'} label="TRAINING TIME" />
              <Metric value={summary ? quantity(summary.volume) : '—'} label="KG VOLUME" />
            </View>
            <Text style={s.body}>{summary ? `${summary.activeMembers} active members · ${summary.sets} sets · ${summary.reps} reps` : 'Weekly totals will appear when the connection is ready.'}</Text>
            {dashboard.weekError && summary ? <Text style={s.hint}>These are the last loaded totals; refresh could not complete.</Text> : null}
          </View>
          {dashboard.weekError ? <Notice problem={dashboard.weekError} retry={refresh} busy={blocked} /> : null}
          <Text style={s.subheading}>MEMBERS</Text>
          <Text style={s.hint}>Tap a member to see their shared workouts. Most active this week comes first.</Text>
        </> : null}
      </>}
      ListEmptyComponent={!dashboard.overview ? (!dashboard.error ? <Loading text="Loading your team..." /> : null) : !team ? <View>
        <View style={[s.panel, { gap: 14 }]}>
          <Ionicons name="people-outline" size={36} color={colors.green} />
          <Text style={s.heading}>TRAIN WITH YOUR CREW</Text>
          <Text style={s.body}>Create a team or join with an invite code. Completed workouts shared with the team appear inside each member's profile.</Text>
          {mode === 'none' ? <>
            <Button title="CREATE TEAM" onPress={() => setMode('create')} disabled={working} />
            <Button title="JOIN TEAM" onPress={() => setMode('join')} secondary disabled={working} />
          </> : <>
            <TextInput accessibilityLabel={mode === 'create' ? 'Team name' : 'Team invite code'}
              value={mode === 'create' ? name : code}
              onChangeText={value => mode === 'create' ? setName(value) : setCode(value.toUpperCase())}
              placeholder={mode === 'create' ? 'Team name' : 'ABC123'} placeholderTextColor={colors.muted}
              autoCapitalize={mode === 'create' ? 'words' : 'characters'} autoCorrect={false}
              maxLength={mode === 'create' ? 40 : 6} editable={!working} style={s.search} />
            <Button title={mode === 'create' ? 'CREATE TEAM' : 'JOIN TEAM'} onPress={() => { void changeTeam(mode === 'create' ? 'create' : 'join'); }} loading={working} />
            <Button title="CANCEL" onPress={() => setMode('none')} secondary disabled={working} />
          </>}
        </View>
      </View> : <Text style={s.body}>No members were returned. Pull down to refresh.</Text>}
      ListFooterComponent={team ? <View style={s.footer}>
        {team.ownerId === viewerUid ? <Text style={s.footerText}>You own this team, so you cannot leave it.</Text> :
          <Button title="LEAVE TEAM" secondary onPress={confirmLeave} loading={working} disabled={blocked} />}
        {working ? <Text style={s.footerText}>Waiting for the server. Keep this screen open until the update completes.</Text> : null}
      </View> : working ? <Text style={s.footerText}>Waiting for the server. Your request has not yet been confirmed.</Text> : null} />
    {selection && focused && selection.teamId === team?.id ? <MemberHistory selection={selection} onClose={closeMember} /> : null}
  </AppBackground>;
}
