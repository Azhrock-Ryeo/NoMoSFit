/** @jsxImportSource react */
/*
 * In-app replacement for the system alert dialog.
 *
 * AppAlert.alert(...) takes the same arguments as React Native's
 * Alert.alert(...), so a screen switches over by changing one import:
 *
 *   import { AppAlert as Alert } from './feedback';
 *
 * The dialog is drawn in the app's own style as a sheet at the bottom
 * of the screen. It is shown in a Modal so it also appears above the
 * editor's other pop-up panels. <AlertHost /> must be mounted once.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Button, T } from './ui';
import { colors, fonts } from './tokens';

export interface AppAlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}
export interface AppAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}
interface Item {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AppAlertOptions;
}

let nextId = 1;
const useAlerts = create<{ queue: Item[] }>(() => ({ queue: [] }));

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[], options?: AppAlertOptions) {
    const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
    useAlerts.setState(state => ({ queue: [...state.queue, { id: nextId++, title, message, buttons: list, options }] }));
  },
};

/** Close first, then run the handler, so a handler may open the next dialog. */
function close(item: Item, after?: () => void) {
  useAlerts.setState(state => ({ queue: state.queue.filter(entry => entry.id !== item.id) }));
  after?.();
}

/** Back button or a tap outside the sheet. */
function dismiss(item: Item) {
  if (item.options?.cancelable) { close(item, item.options.onDismiss); return; }
  const cancel = item.buttons.find(button => button.style === 'cancel');
  if (cancel) { close(item, cancel.onPress); return; }
  if (item.buttons.length === 1) close(item, item.buttons[0].onPress);
  // Otherwise a choice is required: stay open.
}

export function AlertHost() {
  const item = useAlerts(state => state.queue[0]);
  const insets = useSafeAreaInsets();
  if (!item) return null;
  // Main action first, cancel last, as on a bottom sheet.
  const ordered = [...item.buttons].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel'));
  return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => dismiss(item)}>
    <View style={s.backdrop}>
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={() => dismiss(item)} />
      <View accessibilityViewIsModal accessibilityLiveRegion="polite" style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <View style={s.grabber} />
        <T accessibilityRole="header" style={s.title}>{item.title.toUpperCase()}</T>
        {item.message ? <T style={s.message}>{item.message}</T> : null}
        <View style={s.actions}>
          {ordered.map((button, index) => {
            const label = (button.text ?? 'OK').toUpperCase();
            const destructive = button.style === 'destructive';
            const quiet = button.style === 'cancel' || (ordered.length > 1 && index > 0 && !destructive);
            return <Button key={`${item.id}-${index}`} title={label} secondary={quiet || destructive}
              style={destructive ? s.destructive : undefined} onPress={() => close(item, button.onPress)} />;
          })}
        </View>
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.72)' },
  sheet: { backgroundColor: colors.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border, paddingHorizontal: 24, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 18 },
  title: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 23 },
  message: { fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 10 },
  actions: { gap: 10, marginTop: 22 },
  destructive: { borderColor: colors.red },
});
