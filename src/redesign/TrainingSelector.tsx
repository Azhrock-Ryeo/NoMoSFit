/** @jsxImportSource react */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from './tokens';
import { PRESETS, formatTime, swipeChoice, type TrainingMode } from './model';
import { T } from './ui';
import { useReducedMotion } from './motion';

type PresetMode = keyof typeof PRESETS;
interface CardProps { mode: PresetMode; selected: boolean; onChoose: (mode: PresetMode) => void; onGesture: (active: boolean) => void }
function SlidingCard({ mode, selected, onChoose, onGesture }: CardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [cancel, setCancel] = useState(false);
  const reduced = useReducedMotion();
  const callbacks = useRef({ onChoose, onGesture, reduced });
  callbacks.current = { onChoose, onGesture, reduced };
  const reset = () => {
    moved.current = false; setDragging(false); setCancel(false); callbacks.current.onGesture(false);
    if (callbacks.current.reduced) { pan.setValue({ x: 0, y: 0 }); return; }
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, stiffness: 300, damping: 26, mass: 1 }).start();
  };
  useEffect(() => () => { pan.stopAnimation(); if (moved.current) callbacks.current.onGesture(false); }, [pan]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { pan.stopAnimation(); pan.setValue({ x: 0, y: 0 }); moved.current = false; },
    onPanResponderMove: (_, g) => {
      if (!moved.current && Math.max(Math.abs(g.dx), Math.abs(g.dy)) < 4) return;
      if (!moved.current) { moved.current = true; setDragging(true); callbacks.current.onGesture(true); }
      // Immediate physical movement, not onLongPress. Bound travel to keep neighbors readable.
      pan.setValue({ x: Math.max(-64, Math.min(64, g.dx)), y: Math.max(-44, Math.min(32, g.dy)) });
      setCancel(swipeChoice(g.dx, g.dy) === 'up');
    },
    onPanResponderRelease: (_, g) => {
      const direction = swipeChoice(g.dx, g.dy);
      if (!moved.current || direction === 'left' || direction === 'right') callbacks.current.onChoose(mode);
      reset();
    },
    onPanResponderTerminate: reset,
    onPanResponderTerminationRequest: () => !moved.current,
  }), [mode, pan]);
  const preset = PRESETS[mode];
  return <Animated.View {...responder.panHandlers} accessible accessibilityRole="button"
    accessibilityLabel={`${preset.label}. ${preset.range} target reps. ${formatTime(preset.defaultRestSeconds)} rest.`}
    accessibilityState={{ selected }} accessibilityActions={[{ name: 'activate', label: `Select ${preset.label}` }]}
    onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') callbacks.current.onChoose(mode); }}
    style={[s.card, selected && s.selected, dragging && s.dragging, cancel && s.cancel, { transform: pan.getTranslateTransform() }]}>
    <T style={[s.cardTitle, selected && s.selectedText]}>{cancel ? 'CANCEL' : preset.label.toUpperCase()}</T>
    <T style={[s.cardDetail, selected && s.selectedText]}>{preset.range} reps</T>
    <T style={[s.cardDetail, selected && s.selectedText]}>{formatTime(preset.defaultRestSeconds)} rest</T>
  </Animated.View>;
}
export default function TrainingSelector({ mode, rest, onChoose, onCustom, onGesture }: {
  mode: TrainingMode; rest: number; onChoose: (mode: PresetMode) => void; onCustom: () => void; onGesture: (active: boolean) => void;
}) {
  return <View style={s.root}>
    <T style={s.label}>TRAINING STYLE</T>
    <View style={s.row}>{(Object.keys(PRESETS) as PresetMode[]).map(m => <SlidingCard key={m} mode={m} selected={mode === m} onChoose={onChoose} onGesture={onGesture} />)}</View>
    <View style={s.restRow}>
      <View style={{ flex: 1 }}><T style={s.label}>REST BETWEEN SETS</T><T style={s.restValue}>{formatTime(rest)}</T></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Customize target reps and rest time" onPress={onCustom}
        style={[s.custom, mode === 'CUSTOM' && { borderColor: colors.green }]}>
        <Ionicons name="options-outline" size={16} color={colors.green} /><T style={s.customText}>Customize</T>
      </Pressable>
    </View>
    <T style={s.hint}>{mode === 'CUSTOM' ? 'Custom targets are unlocked. Tap an exercise’s reps to edit it.' : 'Tap or slide a style to apply its targets. Swipe up to cancel. Customize unlocks manual reps and rest.'}</T>
  </View>;
}
const s = StyleSheet.create({
  root: { marginTop: 24, marginBottom: 14, zIndex: 2 }, label: { fontSize: 10, color: colors.muted, marginBottom: 9 },
  row: { flexDirection: 'row', gap: 8, overflow: 'visible' },
  card: { flex: 1, minWidth: 0, minHeight: 86, paddingVertical: 13, paddingHorizontal: 3, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  selected: { backgroundColor: colors.green, borderColor: colors.green }, selectedText: { color: '#06290F' },
  dragging: { zIndex: 30, elevation: 12, borderColor: colors.green }, cancel: { borderColor: colors.red },
  cardTitle: { fontSize: 8, fontFamily: fonts.heading, textAlign: 'center' }, cardDetail: { fontSize: 10, color: '#B4B6C0' },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#11151A' },
  restValue: { fontSize: 22, fontFamily: fonts.heading, color: colors.green },
  custom: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center' }, customText: { fontSize: 10 },
  hint: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 10 },
});
