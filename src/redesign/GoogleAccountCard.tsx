/** @jsxImportSource react */
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { AppAlert as Alert } from './feedback';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { authenticateGoogle, googleStatus } from './googleAuth';
import { Button, common, T } from './ui';
import { colors } from './tokens';
/** Deliberate provider linking retains the existing Firebase UID and its local History. */
export function GoogleAccountCard() {
  const user = useAuthStore(state => state.user);
  const [busy, setBusy] = useState(false), [linkedUid, setLinkedUid] = useState<string | null>(null);
  const locked = useRef(false);
  const linked = (!!user && linkedUid === user.uid) || user?.providerData.some(p => p.providerId === 'google.com');
  const status = googleStatus();
  const link = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    const uid = auth.currentUser?.uid;
    try {
      if (await authenticateGoogle('link')) {
        if (auth.currentUser?.uid === uid) { setLinkedUid(uid ?? null); Alert.alert('Google connected', 'This is still the same NoMoSFit account. Your UID and saved History have not changed.'); }
      }
    } catch (err) { Alert.alert('Could not connect Google', err instanceof Error ? err.message : 'Try again.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <View style={[common.panel, { marginTop: 24, marginBottom: 12 }]}>
    <T style={common.section}>GOOGLE ACCOUNT</T>
    <T style={{ color: colors.muted, marginBottom: 14 }}>{linked ? 'Google is connected to this account.' : 'Already have a password account? Link Google here while signed in. This keeps the same account and its saved History instead of creating a different account.'}</T>
    {!linked && <Button title="Link Google to this account" onPress={() => { void link(); }} loading={busy} disabled={!status.enabled} />}
    {!status.enabled && <T style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>{status.message}</T>}
  </View>;
}
