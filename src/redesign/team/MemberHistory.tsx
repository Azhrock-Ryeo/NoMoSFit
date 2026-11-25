/** @jsxImportSource react */
import { T as Text } from '../ui';
import { FlatList, Modal, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { TeamMember } from '../../types/team';
import type { TeamWorkoutActivity } from '../../types/teamActivity';
import { AppBackground, Button, IconButton } from '../ui';
import { colors } from '../tokens';
import { useReducedMotion } from '../motion';
import { useMemberHistory } from './hooks';
import { Avatar, Loading, Notice, WorkoutRow, teamStyles as s } from './components';
import { type HistoryScope } from './model';

export type MemberSelection = HistoryScope & { member: TeamMember; teamName: string };
export default function MemberHistory({ selection, onClose }: { selection: MemberSelection; onClose: () => void }) {
  const reduced = useReducedMotion();
  return <Modal visible animationType={reduced ? 'none' : 'slide'} presentationStyle="fullScreen"
    statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <SafeAreaProvider><HistoryContent key={JSON.stringify([selection.viewerUid, selection.teamId, selection.memberUid])}
      selection={selection} onClose={onClose} /></SafeAreaProvider>
  </Modal>;
}
function HistoryContent({ selection, onClose }: { selection: MemberSelection; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const history = useMemberHistory(selection);
  const busy = history.phase !== 'idle';
  const reload = () => { void history.refresh(); };
  const retry = () => { void history.retry(); };
  return <AppBackground>
    <View style={[s.header, s.page, { paddingTop: insets.top + 8 }]}>
      <IconButton icon="arrow-back" label="Back to Team" onPress={onClose} />
      <Text style={[s.title, { fontSize: 18 }]}>Member history</Text>
      <IconButton icon="refresh" label="Refresh member history" onPress={reload} disabled={busy} />
    </View>
    <FlatList<TeamWorkoutActivity> style={s.flex} data={history.rows}
      keyExtractor={item => item.id} renderItem={({ item }) => <WorkoutRow item={item} />}
      initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5}
      contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 24, flexGrow: 1 }]}
      refreshing={history.phase === 'refreshing'} onRefresh={reload}
      ListHeaderComponent={<>
        <View style={s.profile}>
          <Avatar name={selection.member.displayName} large />
          <Text style={s.heading}>{selection.member.displayName}{selection.memberUid === selection.viewerUid ? ' (You)' : ''}</Text>
          <Text style={s.body}>{selection.member.role === 'owner' ? 'Owner' : 'Member'} · {selection.teamName}</Text>
        </View>
        <Text style={s.subheading}>Shared workouts</Text>
        <Text style={s.hint}>Newest first. Only workout summaries shared with this team appear here. Private or offline-only workouts remain in the athlete's own History.</Text>
        {history.rows.length ? <Text style={s.hint}>{history.rows.length} shared workouts loaded{history.error ? ' · unable to update; entries may be out of date' : ''}</Text> : null}
        {history.error && !history.rows.length ? <Notice problem={history.error} retry={reload} busy={busy} /> : null}
      </>}
      ListEmptyComponent={history.phase === 'loading' ? <Loading text="Loading shared workouts..." /> :
        history.loaded && !history.error ? <View style={s.empty}>
          <Ionicons name="barbell-outline" color={colors.muted} size={34} />
          <Text style={s.heading}>No shared workouts yet</Text>
          <Text style={[s.body, { textAlign: 'center' }]}>Completed workouts that are successfully shared with this team will appear here.</Text>
        </View> : null}
      ListFooterComponent={<View style={s.footer}>
        {history.error && history.rows.length ? <Notice problem={history.error} retry={retry} busy={busy} /> : null}
        {history.phase === 'more' ? <Loading text="Loading older workouts..." /> :
          history.hasMore && !history.error ? <Button title="Load older workouts" onPress={() => { void history.loadMore(); }} disabled={busy} secondary /> : null}
        {history.loaded && history.rows.length && !history.hasMore && !history.error ? <Text style={s.footerText}>You have reached the end of this member's shared history.</Text> : null}
        <Text style={s.footerText}>Volume means the sum of reps × weight, in kg. Individual exercise logs are not included in the existing Team summaries.</Text>
      </View>} />
  </AppBackground>;
}
