/** @jsxImportSource react */
import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextProps, type TextStyle, type TextInputProps, type ViewStyle, type ScrollViewProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WorkoutSession } from '../types/history';
import { assets, colors, fonts } from './tokens';
import { formatTime, summarizeSets } from './model';
import { completedSetRows } from './progressModel';

export function T({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten<TextStyle>([s.text, style]);
  // Titles retain their exact typeface/size. Body text has a readable minimum.
  const body = flat?.fontFamily !== fonts.heading;
  const size = body ? Math.max(12, flat?.fontSize ?? 14) : flat?.fontSize;
  return <Text {...props} style={[s.text, style, body && { fontSize: size, lineHeight: Math.max(flat?.lineHeight ?? 0, Math.ceil((size ?? 14) * 1.4)) }]} />;
}
export function AppBackground({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.root, style]}>
    {/* ImageProps in RN 0.81 do not accept pointerEvents. Keep it on a View. */}
    <View pointerEvents="none" style={s.decorationLayer} accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={assets.background} resizeMode="stretch" fadeDuration={0}
        style={s.backgroundImage} accessible={false} />
    </View>
    {children}
  </View>;
}
export function Screen({ children, scroll = true, scrollEnabled = true, bottomInset = true, style, contentStyle, refreshControl }: { children: React.ReactNode; scroll?: boolean; scrollEnabled?: boolean; bottomInset?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; refreshControl?: ScrollViewProps['refreshControl'] }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const content = [s.content, { paddingHorizontal: Math.min(40, width * .097), paddingTop: insets.top + 24, paddingBottom: (bottomInset ? insets.bottom : 0) + 24 }, contentStyle];
  return <AppBackground style={style}>
    <KeyboardAvoidingView style={s.rootClear} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? <ScrollView refreshControl={refreshControl} scrollEnabled={scrollEnabled} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={content}>{children}</ScrollView> : <View style={[...content, { flex: 1 }]}>{children}</View>}
    </KeyboardAvoidingView>
  </AppBackground>;
}
export function Heading({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return <View style={s.heading}>
    {onBack ? <IconButton icon="arrow-back" label="Go back" onPress={onBack} style={{ marginLeft: -12, marginRight: 2 }} /> : null}
    <T style={s.headingTitle}>{title}</T>{right}
  </View>;
}
export function Brand({ size = 300, wordmark = false }: { size?: number; wordmark?: boolean }) {
  return <View style={s.brand}>
    <Image source={assets.emblem} style={{ width: size, height: size * 604 / 724 }} resizeMode="contain" accessibilityLabel="NoMoSFit emblem" />
    {wordmark ? <Image source={assets.wordmark} style={{ width: size * 1.08, height: size * 1.08 * 191 / 971, marginTop: 8 }} resizeMode="contain" accessibilityLabel="NoMoSFit" /> : null}
  </View>;
}
export function LoadingScreen() {
  const { width } = useWindowDimensions();
  return <Screen scroll={false} contentStyle={{ justifyContent: 'center', alignItems: 'center' }}>
    <Brand size={Math.min(width * .78, 340)} wordmark />
    <ActivityIndicator accessibilityLabel="Loading NoMoSFit" color={colors.green} style={{ marginTop: 24 }} />
  </Screen>;
}
// Keep layout styles STATIC: NativeWind v4 may swallow Pressable style callbacks.
export function Button({ title, onPress, loading = false, disabled = false, secondary = false, style }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean; style?: StyleProp<ViewStyle> }) {
  const [pressed, setPressed] = useState(false);
  const blocked = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: blocked, busy: loading }} disabled={blocked}
    onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={[s.button, secondary && s.secondaryButton, style, blocked && s.buttonDisabled, pressed && s.buttonPressed]}>
    {!secondary && <View pointerEvents="none" style={s.decorationLayer} accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={assets.button} style={s.buttonImage} resizeMode="stretch"
        fadeDuration={0} accessible={false} />
    </View>}
    <View pointerEvents="none" style={s.buttonContent}>
      {loading ? <ActivityIndicator color={colors.white} /> : <T style={[s.buttonText, secondary && { color: colors.white }]}>{title}</T>}
    </View>
  </Pressable>;
}
export function IconButton({ icon, label, onPress, color = colors.muted, style, disabled = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}}
    disabled={disabled} hitSlop={4} onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={[s.iconButton, style, { opacity: disabled ? .3 : pressed ? .55 : 1 }]}>
    <Ionicons name={icon} size={22} color={color}/>
  </Pressable>;
}
/** White pill by default (sign-in screens). `dark` sits quietly on panels and dark screens. */
export function Field({ icon, style, dark = false, ...props }: TextInputProps & { icon?: keyof typeof Ionicons.glyphMap; dark?: boolean }) {
  return <View style={[s.field, dark && s.fieldDark]}>
    {icon && <View style={[s.fieldIcon, dark && { borderColor: colors.border }]}><Ionicons name={icon} color={dark ? colors.muted : '#BCBEC0'} size={dark ? 20 : 24}/></View>}
    <TextInput {...props} style={[s.input, dark && { color: colors.white }, style]} placeholderTextColor={dark ? colors.faint : '#A0A0A6'} selectionColor={colors.green} />
  </View>;
}
export function Divider({ label = 'or login with' }: { label?: string }) {
  return <View style={s.dividerRow}><View style={s.line}/><T style={s.dividerText}>{label}</T><View style={s.line}/></View>;
}
export function Notice({ message, retry }: { message: string; retry?: () => void }) {
  return <View accessibilityLiveRegion="polite" style={s.notice}><T style={{color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18}}>{message}</T>{retry && <Button title="Try again" onPress={retry} style={{marginTop: 12}} secondary/>}</View>;
}
export function Stepper({ value, onMinus, onPlus, label, small = false }: { value: string; onMinus: () => void; onPlus: () => void; label: string; small?: boolean }) {
  return <View style={[s.stepper, small && { backgroundColor: 'transparent', minWidth: 0 }]}>
    <IconButton icon="remove" label={`Decrease ${label}`} onPress={onMinus} color={colors.red} style={small && {width: 30}}/>
    <T style={[s.stepperText, small && {fontSize: 13}]}>{value}</T>
    <IconButton icon="add" label={`Increase ${label}`} onPress={onPlus} color={colors.green} style={small && {width: 30}}/>
  </View>;
}
export type TableRow = { id: string; name: string; sets: string; reps: string; weight: string };
export function ExerciseTable({ rows, duration, compact = false }: { rows: TableRow[]; duration?: number; compact?: boolean }) {
  return <View style={[s.table, compact && { paddingHorizontal: 14 }]}>
    <View style={s.tableRow}><T style={[s.cellName,s.tableHeader]}>EXERCISE</T><T style={[s.cell,s.tableHeader]}>SETS</T><T style={[s.cell,s.tableHeader]}>REPS</T><T style={[s.cell,s.tableHeader]}>KG</T></View>
    {rows.map(row => <View key={row.id} style={s.tableRow}>
      <T numberOfLines={2} style={s.cellName}>{row.name.toUpperCase()}</T>
      <T style={s.cell}>{row.sets}</T><T style={s.cell}>{row.reps}</T><T style={s.cell}>{row.weight}</T>
    </View>)}
    {!rows.length && <T style={{color:colors.muted,fontSize:11,paddingVertical:12}}>No sets recorded.</T>}
    {duration !== undefined && <View style={s.duration}><T style={s.durationLabel}>Duration</T><T style={s.durationValue}>{formatTime(duration)}</T></View>}
  </View>;
}
export function SessionTable({ session, highlight = false }: { session: WorkoutSession; highlight?: boolean }) {
  const rows = completedSetRows(session);
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) { const list = grouped.get(row.exerciseId) ?? []; list.push(row); grouped.set(row.exerciseId, list); }
  return <View style={[s.table, highlight && { borderColor: colors.green, borderWidth: 2, backgroundColor: '#10231A' }]}>
    {[...grouped.entries()].map(([id, sets]) => <View key={id} style={{ marginBottom: 18 }}>
      <T style={{ fontFamily: fonts.heading, fontSize: 14, marginBottom: 10 }}>{sets[0].name.toUpperCase()}</T>
      <View style={s.tableRow}><T style={[s.cell,s.tableHeader]}>SET</T><T style={[s.cell,s.tableHeader]}>REPS</T><T style={[s.cell,s.tableHeader]}>KG</T></View>
      {sets.map(row => <View key={row.key} style={[s.tableRow, { borderBottomWidth: 1, borderColor: colors.border }]}>
        <T style={s.cell}>{row.number}</T><T style={[s.cell, { fontWeight: '700' }]}>{row.reps}</T><T style={s.cell}>{row.kg}</T>
      </View>)}
    </View>)}
    {!rows.length && <T style={{ color: colors.muted }}>No completed sets were recorded.</T>}
    <View style={s.duration}><T>Duration</T><T style={{ color: colors.green }}>{formatTime(session.durationSeconds)}</T></View>
  </View>;
}
export function ProgressTable({ current, previous }: { current: WorkoutSession; previous?: WorkoutSession }) {
  if (!previous) return <Notice message="Your first recorded workout. Complete this program again to compare your progress."/>;
  const before = summarizeSets(previous.completedSets);
  const rows = summarizeSets(current.completedSets).map(row => {
    const old = before.find(r => r.id === row.id);
    const delta = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`;
    return { id:row.id, name:row.name, sets:old ? delta(row.sets-old.sets) : 'NEW',
      reps:old ? delta(row.reps.reduce((a,b)=>a+b,0)-old.reps.reduce((a,b)=>a+b,0)) : '—',
      weight:old ? delta(Math.max(...row.weights)-Math.max(...old.weights)) : '—' };
  });
  return <View><ExerciseTable rows={rows}/><T style={{fontSize:9,color:colors.muted,marginTop:8,lineHeight:14}}>Change in sets, total reps, and highest weight. These are measurements, not a fitness score.</T></View>;
}
export const common = StyleSheet.create({
  section: { fontFamily: fonts.heading, color: colors.white, fontSize: 16, textAlign: 'center', marginBottom: 14, marginTop: 24 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 18 },
  green: { color: colors.green },
});
const s = StyleSheet.create({
  root:{flex:1, backgroundColor:colors.background}, rootClear:{flex:1},
  decorationLayer:{position:'absolute',top:0,right:0,bottom:0,left:0},
  backgroundImage:{position:'absolute',top:0,left:0,width:'100%',height:'100%'},
  content:{flexGrow:1,width:'100%',maxWidth:540,alignSelf:'center'},
  text:{fontFamily:fonts.body,color:colors.white,fontSize:14,includeFontPadding:false},
  heading:{flexDirection:'row',alignItems:'center',minHeight:44,marginBottom:18},
  headingTitle:{fontFamily:fonts.heading,fontSize:18,flex:1},
  brand:{alignItems:'center'},
  button:{minHeight:52,flexShrink:0,width:'100%',alignSelf:'stretch',borderRadius:16,overflow:'hidden',backgroundColor:colors.greenDark,alignItems:'center',justifyContent:'center'},
  buttonImage:{position:'absolute',top:0,left:0,width:'100%',height:'100%'},
  buttonContent:{minHeight:52,width:'100%',paddingHorizontal:16,paddingVertical:14,alignItems:'center',justifyContent:'center'},
  buttonText:{fontSize:15,lineHeight:21,fontFamily:fonts.heading,textAlign:'center'},
  buttonDisabled:{opacity:.45},buttonPressed:{opacity:.82,transform:[{scale:.99}]},
  secondaryButton:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel},
  iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  field:{backgroundColor:'#FFFFFF',borderRadius:20,minHeight:46,flexDirection:'row',alignItems:'center',overflow:'hidden'},
  fieldDark:{backgroundColor:'#12151C',borderRadius:14,borderWidth:1,borderColor:colors.border},
  fieldIcon:{width:44,alignItems:'center',borderRightWidth:1,borderColor:'#D4D4D8'},
  input:{flex:1,minWidth:0,color:'#181A25',fontSize:14,paddingHorizontal:14,paddingVertical:10,fontFamily:fonts.body},
  dividerRow:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:24},line:{height:1,flex:1,backgroundColor:'#555561'},dividerText:{fontSize:9,color:colors.muted},
  notice:{padding:18,borderRadius:12,backgroundColor:colors.panel,marginVertical:12},
  stepper:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:colors.panel,borderRadius:14,minWidth:180},
  stepperText:{fontFamily:fonts.heading,fontSize:22,color:colors.white,textAlign:'center'},
  table:{backgroundColor:colors.panel,borderColor:colors.border,borderWidth:1,borderRadius:10,padding:18},
  tableRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,gap:5},
  cellName:{flex:2.3,fontSize:10,color:colors.green,lineHeight:15},cell:{flex:1,fontSize:10,color:colors.green,textAlign:'center'},
  tableHeader:{color:colors.white,fontSize:10},duration:{borderTopWidth:1,borderColor:colors.border,marginTop:8,paddingTop:12,flexDirection:'row',justifyContent:'space-between'},
  durationLabel:{fontSize:11},durationValue:{fontSize:11,color:colors.green},
});
