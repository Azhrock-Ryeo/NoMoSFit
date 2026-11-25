/** @jsxImportSource react */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { colors, fonts } from './tokens';
import { T } from './ui';
import { MIN_REPS, MAX_REPS, REP_ITEM_WIDTH, REP_VALUES, offsetForRep, pickerPadding, repFromOffset, safeRep } from './repPickerMath';

export interface RepPickerHandle { getValue: () => number }
type Props = { value: number; onChange: (value: number) => void };

/** Controlled, center-snapping ACTUAL-rep input. Program target reps stay unchanged. */
export const RepPicker = forwardRef<RepPickerHandle, Props>(function RepPicker({ value, onChange }, forwardedRef) {
  const list = useRef<FlatList<number>>(null);
  const selected = useRef(safeRep(value));
  const latest = useRef(onChange);
  latest.current = onChange;
  const dragging = useRef(false);
  const momentum = useRef(false);
  const interactive = useRef(false);
  const lastOffset = useRef(offsetForRep(value));
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const [display, setDisplay] = useState(safeRep(value));

  const clearSettle = () => { if (settleTimer.current !== null) clearTimeout(settleTimer.current); settleTimer.current = null; };
  const commit = (rep: number) => {
    const next = safeRep(rep);
    setDisplay(next);
    if (next !== selected.current) { selected.current = next; latest.current(next); }
  };
  const align = (rep: number, animated: boolean) => {
    const offset = offsetForRep(rep);
    lastOffset.current = offset;
    list.current?.scrollToOffset({ offset, animated });
  };
  const settle = () => {
    clearSettle();
    const rep = repFromOffset(lastOffset.current);
    commit(rep);
    // Native snapToInterval does the animated settling. This removes subpixel/slow-drag drift.
    align(rep, false);
    interactive.current = false;
  };
  const scheduleSettle = () => {
    clearSettle();
    settleTimer.current = setTimeout(() => {
      if (!dragging.current && !momentum.current) settle();
    }, 150);
  };
  const select = (rep: number) => {
    clearSettle(); dragging.current = false; momentum.current = false; interactive.current = false;
    commit(rep);
    // Tap selection is exact immediately, not an animation across intermediate rep values.
    align(rep, false);
  };
  useImperativeHandle(forwardedRef, () => ({ getValue: () => selected.current }), []);
  useEffect(() => {
    const next = safeRep(value);
    if (next !== selected.current && !dragging.current && !momentum.current) {
      selected.current = next; setDisplay(next); align(next, false);
    }
  }, [value]);
  const alignInitial = () => {
    if (!width || interactive.current || dragging.current || momentum.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { align(selected.current, false); frame.current = null; });
  };
  useEffect(() => { alignInitial(); }, [width]);
  useEffect(() => () => {
    clearSettle(); if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!interactive.current && !dragging.current && !momentum.current) return;
    lastOffset.current = event.nativeEvent.contentOffset.x;
    commit(repFromOffset(lastOffset.current));
    if (!dragging.current && !momentum.current) scheduleSettle();
  };

  return <View style={s.root}>
    <View style={s.labelRow}><T style={s.label}>ACTUAL REPS COMPLETED</T><T style={s.selectedText}>{display} reps</T></View>
    <View style={s.viewport} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View pointerEvents="none" style={[s.centerWindow, { left: '50%', marginLeft: -REP_ITEM_WIDTH / 2 }]} />
      <View pointerEvents="none" style={s.marker} />
      {width > 0 && <FlatList ref={list} horizontal data={REP_VALUES} extraData={display}
        style={s.list} contentContainerStyle={{ paddingHorizontal: pickerPadding(width) }}
        keyExtractor={rep => String(rep)} showsHorizontalScrollIndicator={false}
        snapToInterval={REP_ITEM_WIDTH} snapToAlignment="start" decelerationRate="fast"
        bounces={false} overScrollMode="never" contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={16} nestedScrollEnabled removeClippedSubviews={false}
        initialNumToRender={15} windowSize={5} getItemLayout={(_, index) => ({ length: REP_ITEM_WIDTH, offset: pickerPadding(width) + REP_ITEM_WIDTH * index, index })}
        onContentSizeChange={alignInitial} onScroll={onScroll}
        onScrollBeginDrag={() => { clearSettle(); dragging.current = true; momentum.current = false; interactive.current = true; }}
        onScrollEndDrag={event => { dragging.current = false; lastOffset.current = event.nativeEvent.contentOffset.x; commit(repFromOffset(lastOffset.current)); scheduleSettle(); }}
        onMomentumScrollBegin={() => { if (!interactive.current) return; clearSettle(); momentum.current = true; }}
        onMomentumScrollEnd={event => { if (!interactive.current && !momentum.current) return; momentum.current = false; lastOffset.current = event.nativeEvent.contentOffset.x; settle(); }}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item === display }}
          accessibilityLabel={`${item} completed reps`} onPress={() => select(item)} style={s.item}>
          <T style={[s.number, item === display && s.numberSelected]}>{item}</T>
        </Pressable>}
      />}
    </View>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="Actual reps completed"
      accessibilityValue={{ min: MIN_REPS, max: MAX_REPS, now: display }}
      accessibilityActions={[{ name: 'increment', label: 'One more rep' }, { name: 'decrement', label: 'One fewer rep' }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'increment') select(selected.current + 1);
        if (event.nativeEvent.actionName === 'decrement') select(selected.current - 1);
      }}>
      <T style={s.hint}>Slide to select. The number in the center is saved.</T>
    </View>
  </View>;
});
const s = StyleSheet.create({
  root: { marginTop: 22, marginBottom: 24 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  label: { fontSize: 10, color: colors.muted, flex: 1 }, selectedText: { color: colors.green, fontSize: 12 },
  viewport: { height: 76, overflow: 'hidden', borderRadius: 18, backgroundColor: '#12151C', borderWidth: 1, borderColor: colors.border },
  list: { flexGrow: 0, height: 76, width: '100%' }, item: { width: REP_ITEM_WIDTH, height: 74, alignItems: 'center', justifyContent: 'center' },
  centerWindow: { position: 'absolute', top: 12, bottom: 12, width: REP_ITEM_WIDTH, backgroundColor: '#173923', borderRadius: 13, borderWidth: 1, borderColor: colors.green },
  marker: { position: 'absolute', top: 3, left: '50%', marginLeft: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  number: { color: '#9295A1', fontSize: 16 }, numberSelected: { color: colors.green, fontFamily: fonts.heading, fontSize: 25 },
  hint: { color: colors.muted, fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 9 },
});
