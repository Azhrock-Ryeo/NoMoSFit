/** @jsxImportSource react */
/*
 * Profile tab, in the redesign's visual system.
 *
 *   ProfileScreen          who you are, your totals, cloud backup, sign out
 *   AccountSettingsScreen  name, email, Google, password, delete account
 *
 * Account actions call the same accountService functions as before.
 * Results are shown inline on the card that caused them; a system
 * dialog is used only to confirm sign-out and permanent deletion.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppAlert as Alert } from './feedback';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useProgramStore } from '../store/programStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { useTeamStore } from '../store/teamStore';
import { useTeamActivityStore } from '../store/teamActivityStore';
import { signOut } from '../services/authService';
import {
  accountUsesPassword, changeAccountPassword, deleteAccountPermanently, refreshAccount,
  requestAccountEmailChange, sendAccountPasswordResetEmail, sendAccountVerificationEmail,
  updateAccountDisplayName,
} from '../services/accountService';
import { Button, common, Field, Heading, IconButton, Screen, T } from './ui';
import { colors, fonts } from './tokens';
import { compactNumber, historyDate, historyTime, sessionStats } from './historyModel';
import { auth } from '../config/firebase';
import { authenticateGoogle, googleStatus } from './googleAuth';
import { syncRoutinesAndReload } from './programSync';
import type { ProfileProps } from './routes';

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function accountError(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.';
  const m = error.message;
  if (m.includes('auth/wrong-password') || m.includes('auth/invalid-credential')) return 'Your current password is incorrect.';
  if (m.includes('auth/email-already-in-use')) return 'That email address is already used by another account.';
  if (m.includes('auth/invalid-email')) return 'Enter a valid email address.';
  if (m.includes('auth/too-many-requests')) return 'Too many attempts. Please wait and try again.';
  if (m.includes('auth/requires-recent-login')) return 'Please sign in again before doing this.';
  if (m.includes('auth/weak-password')) return 'Choose a stronger password.';
  if (m.includes('auth/network-request-failed')) return 'No connection. Check your network and try again.';
  return m;
}

function fallbackName(email?: string | null) {
  return email?.split('@')[0].replace(/[._-]/g, ' ') ?? '';
}

/** 19h 56m reads better than 19:56:00 for a lifetime total. */
function totalTime(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60), hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function startOfWeek() {
  const now = new Date();
  const fromMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - fromMonday).getTime();
}

type Message = { text: string; ok: boolean } | null;

/** Result of an action, shown on the card it belongs to. */
function Banner({ message }: { message: Message }) {
  if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={[s.banner, message.ok ? s.bannerOk : s.bannerBad]}>
    <Ionicons name={message.ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={message.ok ? colors.green : colors.red} />
    <T style={s.bannerText}>{message.text}</T>
  </View>;
}

function Card({ icon, title, subtitle, danger = false, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; danger?: boolean; children?: React.ReactNode }) {
  return <View style={[common.panel, s.card, danger && { borderColor: '#83424A' }]}>
    <View style={s.cardHead}>
      <View style={[s.cardIcon, danger && { backgroundColor: '#2C2021' }]}><Ionicons name={icon} size={20} color={danger ? colors.red : colors.green} /></View>
      <View style={{ flex: 1 }}>
        <T style={s.cardTitle}>{title.toUpperCase()}</T>
        {subtitle ? <T numberOfLines={2} style={s.cardSubtitle}>{subtitle}</T> : null}
      </View>
    </View>
    {children}
  </View>;
}

/** Text-style action with a full-size touch target. */
function LinkButton({ title, icon, onPress, disabled = false, color = colors.green, center = false }: { title: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; color?: string; center?: boolean }) {
  const [pressed, setPressed] = useState(false);
  // Static style arrays only: NativeWind v4 may swallow Pressable style callbacks.
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={[s.link, center && { alignSelf: 'center' }, (pressed || disabled) && { opacity: .5 }]}>
    {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
    <T style={[s.linkText, { color }]}>{title}</T>
  </Pressable>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={[common.panel, s.stat]}>
    <T numberOfLines={1} adjustsFontSizeToFit style={s.statValue}>{value}</T>
    <T style={s.statLabel}>{label}</T>
  </View>;
}

/* ------------------------------------------------------------------ */
/* Cloud backup status                                                 */
/* ------------------------------------------------------------------ */

function BackupCard() {
  const status = useWorkoutHistoryStore(state => state.syncStatus);
  const pending = useWorkoutHistoryStore(state => state.pendingSyncCount);
  const lastSyncedAt = useWorkoutHistoryStore(state => state.lastSyncedAt);
  const busy = status === 'syncing';
  const waiting = `${pending} ${pending === 1 ? 'workout' : 'workouts'} waiting to upload`;
  const line =
    busy ? 'Syncing…'
    : status === 'offline' ? (pending ? `Offline. ${waiting}.` : 'Offline. Workouts will upload when you reconnect.')
    : status === 'error' ? (pending ? `Could not reach the server. ${waiting}.` : 'Could not reach the server. It will retry.')
    : pending ? `${waiting}.`
    : status === 'synced' ? 'All workouts are backed up.'
    : 'Checking your backup…';
  const [restore, setRestore] = useState<Message>(null);
  // Re-reads the whole backup and adds anything this phone is missing. Never removes anything.
  const restoreAll = async () => {
    setRestore(null);
    const [history] = await Promise.all([
      useWorkoutHistoryStore.getState().syncNow({ force: true, full: true }),
      syncRoutinesAndReload({ force: true }),
    ]);
    if (!history || history.status !== 'synced') { setRestore({ ok: false, text: history?.status === 'offline' ? 'You are offline. Connect and try again.' : 'Could not reach your backup. Try again.' }); return; }
    setRestore({ ok: true, text: history.restored > 0
      ? `Restored ${history.restored} ${history.restored === 1 ? 'workout' : 'workouts'} from your backup.`
      : 'Nothing to restore. This phone already has every workout in your backup.' });
  };
  const healthy = !busy && status === 'synced' && pending === 0;
  const when = lastSyncedAt ? `Last synced ${historyDate(lastSyncedAt)}, ${historyTime(lastSyncedAt)}` : 'Not synced on this phone yet';
  return <Card icon={healthy ? 'cloud-done-outline' : status === 'offline' ? 'cloud-offline-outline' : 'cloud-upload-outline'} title="Cloud backup" subtitle={when}>
    <View style={s.backupRow}>
      <View style={[s.dot, { backgroundColor: healthy ? colors.green : status === 'error' ? colors.red : colors.muted }]} />
      <T style={s.backupText}>{line}</T>
    </View>
    <Button title="SYNC NOW" secondary loading={busy} onPress={() => { setRestore(null); void useWorkoutHistoryStore.getState().syncNow({ force: true }); void syncRoutinesAndReload({ force: true }); }} style={{ marginTop: 14 }} />
    <Banner message={restore} />
    <LinkButton center title="Restore from cloud" icon="cloud-download-outline" color={colors.muted} disabled={busy} onPress={() => { void restoreAll(); }} />
  </Card>;
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export function ProfileScreen({ navigation }: ProfileProps<'ProfileHome'>) {
  const user = useAuthStore(state => state.user);
  const uid = user?.uid;
  const owner = useWorkoutHistoryStore(state => state.ownerUid);
  const allSessions = useWorkoutHistoryStore(state => state.sessions);
  const sessions = owner === uid && uid ? allSessions : [];
  const [name, setName] = useState(user?.displayName ?? fallbackName(user?.email));
  const [email, setEmail] = useState(user?.email ?? '');
  const [verified, setVerified] = useState(user?.emailVerified ?? false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void useWorkoutHistoryStore.getState().loadHistory();
    refreshAccount().then(account => {
      if (!active) return;
      setVerified(account.emailVerified); setEmail(account.email ?? '');
      if (account.displayName) setName(account.displayName);
    }).catch(() => { /* Account may still be restoring during startup. */ });
    return () => { active = false; };
  }, []));

  const totals = useMemo(() => {
    const week = startOfWeek();
    const exercises = new Set<string>();
    let sets = 0, reps = 0, volume = 0, seconds = 0, thisWeek = 0;
    for (const session of sessions) {
      const stats = sessionStats(session);
      sets += stats.sets; reps += stats.reps; volume += stats.volume; seconds += stats.seconds;
      if (session.finishedAt >= week) thisWeek++;
      session.completedSets.forEach(set => exercises.add(set.exerciseId));
    }
    return { workouts: sessions.length, sets, reps, volume, seconds, thisWeek, exercises: exercises.size };
  }, [sessions]);

  const shownName = name.trim() || fallbackName(email) || 'Athlete';
  const confirmSignOut = () => Alert.alert('Sign out?', 'Your workouts stay saved on this phone and in your cloud backup.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => { signOut().catch(() => Alert.alert('Sign out failed', 'Please try again.')); } },
  ]);

  return <Screen bottomInset={false} contentStyle={{ paddingHorizontal: 24 }}>
    <Heading title="PROFILE" right={<IconButton icon="settings-outline" label="Account settings" color={colors.green} onPress={() => navigation.navigate('AccountSettings')} />} />

    <View style={[common.panel, s.identity]}>
      <View style={s.avatar}><T style={s.avatarText}>{shownName.charAt(0).toUpperCase()}</T></View>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} style={s.name}>{shownName.toUpperCase()}</T>
        <T numberOfLines={1} style={s.email}>{email || 'No email'}</T>
        <View style={s.verifyRow}>
          <Ionicons name={verified ? 'checkmark-circle' : 'alert-circle'} size={15} color={verified ? colors.green : colors.muted} />
          <T style={[s.verifyText, verified && { color: colors.green }]}>{verified ? 'Email verified' : 'Email not verified'}</T>
        </View>
      </View>
    </View>

    <View style={[common.panel, s.week]}>
      <View style={{ flex: 1 }}>
        <T style={s.label}>THIS WEEK</T>
        <T style={s.weekValue}>{totals.thisWeek}<T style={s.weekUnit}> {totals.thisWeek === 1 ? 'workout' : 'workouts'}</T></T>
      </View>
      <View style={s.weekIcon}><Ionicons name="flame" size={24} color={colors.green} /></View>
    </View>

    <T style={s.section}>ALL TIME</T>
    <View style={s.grid}>
      <Stat value={String(totals.workouts)} label="WORKOUTS" />
      <Stat value={compactNumber(totals.sets)} label="SETS" />
    </View>
    <View style={s.grid}>
      <Stat value={compactNumber(totals.reps)} label="REPS" />
      <Stat value={compactNumber(totals.volume)} label="KG VOLUME" />
    </View>
    <View style={[common.panel, s.secondary]}>
      <View style={s.secondaryItem}><T style={s.secondaryValue}>{totals.exercises}</T><T style={s.statLabel}>EXERCISES TRAINED</T></View>
      <View style={s.secondaryDivider} />
      <View style={s.secondaryItem}><T style={s.secondaryValue}>{totalTime(totals.seconds)}</T><T style={s.statLabel}>TRAINING TIME</T></View>
    </View>

    <BackupCard />

    <Button title="ACCOUNT SETTINGS" secondary onPress={() => navigation.navigate('AccountSettings')} style={{ marginTop: 20 }} />
    <View style={{ marginTop: 6, marginBottom: 12 }}>
      <LinkButton center title="Sign out" icon="log-out-outline" color={colors.red} onPress={confirmSignOut} />
    </View>
  </Screen>;
}

/* ------------------------------------------------------------------ */
/* Account settings                                                    */
/* ------------------------------------------------------------------ */

export function AccountSettingsScreen({ navigation }: ProfileProps<'AccountSettings'>) {
  const user = useAuthStore(state => state.user);
  const usesPassword = accountUsesPassword();
  const [name, setName] = useState(user?.displayName ?? fallbackName(user?.email));
  const [email, setEmail] = useState(user?.email ?? '');
  const [verified, setVerified] = useState(user?.emailVerified ?? false);
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message>>({});
  const say = (card: string, text: string, ok: boolean) => setMessages(all => ({ ...all, [card]: { text, ok } }));

  const [emailForm, setEmailForm] = useState(false), [newEmail, setNewEmail] = useState(''), [emailPassword, setEmailPassword] = useState('');
  const [passwordForm, setPasswordForm] = useState(false), [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [deleteForm, setDeleteForm] = useState(false), [deletePassword, setDeletePassword] = useState(''), [deleteWord, setDeleteWord] = useState('');

  const applyAccount = (account: { displayName: string | null; email: string | null; emailVerified: boolean }) => {
    setVerified(account.emailVerified); setEmail(account.email ?? '');
    if (account.displayName) setName(account.displayName);
  };
  useFocusEffect(useCallback(() => {
    let active = true;
    refreshAccount().then(account => { if (active) applyAccount(account); }).catch(() => {});
    return () => { active = false; };
  }, []));

  /** Runs one action at a time and reports the outcome on its own card. */
  const run = async (card: string, action: () => Promise<string>) => {
    if (busy) return;
    setBusy(card); setMessages(all => ({ ...all, [card]: null }));
    try { const text = await action(); if (text) say(card, text, true); }
    catch (error) { say(card, accountError(error), false); }
    finally { setBusy(null); }
  };

  const saveName = () => run('name', async () => {
    const result = await updateAccountDisplayName(name);
    setName(result.displayName);
    return 'Display name saved.';
  });
  const sendVerification = () => run('email', async () => {
    await sendAccountVerificationEmail();
    return `Verification email sent to ${email || 'your inbox'}. Open the link, then tap Refresh status.`;
  });
  const refreshStatus = () => run('email', async () => {
    const account = await refreshAccount(); applyAccount(account);
    if (!account.emailVerified) throw new Error('Not verified yet. Open the link in your email, then refresh again.');
    return 'Your account is up to date.';
  });
  const changeEmail = () => run('email', async () => {
    if (!newEmail.trim()) throw new Error('Enter the new email address.');
    if (!emailPassword) throw new Error('Enter your current password.');
    const requested = await requestAccountEmailChange(emailPassword, newEmail);
    setNewEmail(''); setEmailPassword(''); setEmailForm(false);
    return `Verification link sent to ${requested}. Your email changes after you open it.`;
  });
  const changePassword = () => run('password', async () => {
    if (newPassword !== confirmPassword) throw new Error('The two new passwords do not match.');
    if (newPassword.length < 6) throw new Error('Your new password must be at least 6 characters.');
    await changeAccountPassword(currentPassword, newPassword);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordForm(false);
    return 'Password changed.';
  });
  const sendReset = () => run('password', async () => {
    await sendAccountPasswordResetEmail();
    return `Password reset email sent to ${email || 'your account email'}.`;
  });

  // Linking keeps the existing Firebase UID, so local History and the cloud backup stay attached.
  const [linkedUid, setLinkedUid] = useState<string | null>(null);
  const google = googleStatus();
  const googleLinked = (!!user && linkedUid === user.uid) || !!user?.providerData.some(p => p.providerId === 'google.com');
  const linkGoogle = () => run('google', async () => {
    const uid = auth.currentUser?.uid;
    if (!(await authenticateGoogle('link'))) return ''; // Cancelled: nothing to report.
    if (auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed. Try again.');
    setLinkedUid(uid ?? null);
    return 'Google connected. This is still the same account and History.';
  });

  const clearStoresAfterDeletion = () => {
    useProgramStore.setState({ programs: [], hasLoaded: false });
    useWorkoutHistoryStore.setState({ sessions: [], hasLoaded: false });
    useWorkoutStore.setState({ workout: null });
    useTeamStore.setState({ team: null, members: [], hasLoaded: false, error: null });
    useTeamActivityStore.getState().clear();
  };
  const deleteAccount = () => {
    if (deleteWord !== 'DELETE') { say('delete', 'Type DELETE exactly to confirm.', false); return; }
    if (!deletePassword) { say('delete', 'Enter your current password.', false); return; }
    Alert.alert('Permanently delete account?', 'This cannot be undone. Your account, programs, workout history, cloud backup and Team data will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => {
        if (busy) return;
        setBusy('delete'); setMessages(all => ({ ...all, delete: null }));
        // On success the auth listener signs the user out, which unmounts this screen.
        deleteAccountPermanently(deletePassword).then(clearStoresAfterDeletion)
          .catch(error => { say('delete', accountError(error), false); setBusy(null); });
      } },
    ]);
  };

  return <Screen bottomInset={false} contentStyle={{ paddingHorizontal: 24 }}>
    <Heading title="ACCOUNT SETTINGS" onBack={() => navigation.goBack()} />

    <Card icon="person-outline" title="Display name" subtitle="Shown across NoMoSFit and on your Team roster.">
      <Field dark accessibilityLabel="Display name" value={name} onChangeText={setName} placeholder="Your name" maxLength={40} />
      <Banner message={messages.name ?? null} />
      <Button title="SAVE NAME" onPress={saveName} loading={busy === 'name'} disabled={!!busy && busy !== 'name'} style={s.action} />
    </Card>

    <Card icon={verified ? 'shield-checkmark-outline' : 'mail-outline'} title="Email" subtitle={email || 'No email'}>
      <View style={s.backupRow}>
        <View style={[s.dot, { backgroundColor: verified ? colors.green : colors.muted }]} />
        <T style={s.backupText}>{verified ? 'Email verified' : 'Email not verified yet'}</T>
      </View>
      <Banner message={messages.email ?? null} />
      {!verified && <Button title="SEND VERIFICATION EMAIL" onPress={sendVerification} loading={busy === 'email' && !emailForm} disabled={!!busy} style={s.action} />}
      <LinkButton title="Refresh status" icon="refresh-outline" color={colors.muted} onPress={refreshStatus} disabled={!!busy} />
      {usesPassword && <>
        <LinkButton title={emailForm ? 'Cancel email change' : 'Change email'} icon="create-outline" onPress={() => setEmailForm(open => !open)} disabled={!!busy} />
        {emailForm && <View style={s.form}>
          <Field dark accessibilityLabel="New email address" icon="mail-outline" value={newEmail} onChangeText={setNewEmail} placeholder="New email address" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Field dark accessibilityLabel="Current password" icon="lock-closed-outline" value={emailPassword} onChangeText={setEmailPassword} placeholder="Current password" secureTextEntry autoCapitalize="none" />
          <Button title="VERIFY NEW EMAIL" onPress={changeEmail} loading={busy === 'email'} disabled={!!busy && busy !== 'email'} />
        </View>}
      </>}
    </Card>

    <Card icon="logo-google" title="Google account" subtitle={googleLinked ? 'Connected to this account.' : 'Not connected.'}>
      {!googleLinked && <T style={s.note}>Link Google to sign in with it. This keeps the same account and its saved History.</T>}
      <Banner message={messages.google ?? null} />
      {!googleLinked && <Button title="LINK GOOGLE" onPress={linkGoogle} loading={busy === 'google'} disabled={!google.enabled || (!!busy && busy !== 'google')} style={s.action} />}
      {!google.enabled && <T style={[s.note, { marginTop: 10 }]}>{google.message}</T>}
    </Card>

    <Card icon="key-outline" title="Password" subtitle={usesPassword ? 'Keep your account secure.' : 'Managed by your sign-in provider.'}>
      <Banner message={messages.password ?? null} />
      {usesPassword && <>
        <LinkButton title={passwordForm ? 'Cancel password change' : 'Change password'} icon="lock-closed-outline" onPress={() => setPasswordForm(open => !open)} disabled={!!busy} />
        {passwordForm && <View style={s.form}>
          <Field dark accessibilityLabel="Current password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry autoCapitalize="none" />
          <Field dark accessibilityLabel="New password" value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry autoCapitalize="none" />
          <Field dark accessibilityLabel="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" secureTextEntry autoCapitalize="none" />
          <Button title="UPDATE PASSWORD" onPress={changePassword} loading={busy === 'password'} disabled={!!busy && busy !== 'password'} />
        </View>}
        <LinkButton title="Send password reset email" icon="mail-outline" color={colors.muted} onPress={sendReset} disabled={!!busy} />
      </>}
    </Card>

    <Card danger icon="trash-outline" title="Delete account" subtitle="Permanently removes your account and its data.">
      <Banner message={messages.delete ?? null} />
      {!usesPassword ? <T style={s.note}>Deleting an account that signs in only with Google is not available yet.</T>
        : !deleteForm ? <LinkButton title="Delete account" icon="trash-outline" color={colors.red} onPress={() => setDeleteForm(true)} disabled={!!busy} />
        : <View style={s.form}>
          <T style={s.note}>This cannot be undone. If you own a Team, the Team and its shared activity are deleted too.</T>
          <Field dark accessibilityLabel="Current password" value={deletePassword} onChangeText={setDeletePassword} placeholder="Current password" secureTextEntry autoCapitalize="none" />
          <Field dark accessibilityLabel="Type DELETE to confirm" value={deleteWord} onChangeText={setDeleteWord} placeholder="Type DELETE" autoCapitalize="characters" autoCorrect={false} />
          <Button title="PERMANENTLY DELETE" secondary onPress={deleteAccount} loading={busy === 'delete'} disabled={!!busy && busy !== 'delete'} style={{ borderColor: colors.red }} />
          <LinkButton title="Cancel" color={colors.muted} onPress={() => { setDeleteForm(false); setDeletePassword(''); setDeleteWord(''); setMessages(all => ({ ...all, delete: null })); }} disabled={!!busy} />
        </View>}
    </Card>
    <View style={{ height: 12 }} />
  </Screen>;
}

const s = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#11291A', borderWidth: 1, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.heading, fontSize: 26, color: colors.green },
  name: { fontFamily: fonts.heading, fontSize: 18 },
  email: { fontSize: 13, color: colors.muted, marginTop: 4 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  verifyText: { fontSize: 12, color: colors.muted },
  week: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  weekValue: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 40, marginTop: 4 },
  weekUnit: { fontFamily: fonts.heading, fontSize: 14, color: colors.muted },
  weekIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#11291A', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, color: colors.muted, letterSpacing: 1 },
  section: { fontSize: 12, color: colors.muted, letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30 },
  statLabel: { fontSize: 12, color: colors.muted, letterSpacing: 1, marginTop: 4 },
  secondary: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  secondaryItem: { flex: 1, alignItems: 'center' },
  secondaryValue: { fontFamily: fonts.heading, fontSize: 18 },
  secondaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  card: { marginTop: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#11291A', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.heading, fontSize: 14 },
  cardSubtitle: { fontSize: 12, color: colors.muted, marginTop: 3 },
  backupRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backupText: { fontSize: 14, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  action: { marginTop: 14 },
  form: { gap: 10, marginTop: 6, marginBottom: 6 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingRight: 8 },
  linkText: { fontSize: 14 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 12 },
  bannerOk: { backgroundColor: '#10231A', borderColor: '#1C6440' },
  bannerBad: { backgroundColor: '#2C2021', borderColor: '#83424A' },
  bannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
