/** @jsxImportSource react */
import { compactNumber, historyDate, sessionStats } from './historyModel';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, Easing, Modal, Pressable, ScrollView, StyleSheet, Vibration, View, useWindowDimensions } from 'react-native';
import { AppAlert as Alert } from './feedback';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { auth } from '../config/firebase';
import { useWorkoutStore } from '../store/workoutStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { publishTeamWorkoutActivity } from '../services/teamActivityService';
import { Brand, Button, common, Field, IconButton, Notice, Screen, SessionTable, T } from './ui';
import { useReducedMotion } from './motion';
import { colors, fonts } from './tokens';
import { formatTime, previousSession, repLabel, summarizeSets } from './model';
import type { WorkoutSession } from '../types/history';
import { useWorkoutPresentation, beginProgramRest } from './startWorkout';
import { RepPicker, type RepPickerHandle } from './RepPicker';
import type { RootProps } from './routes';

function useClock(){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{
    const tick=()=>setNow(Date.now()); const id=setInterval(tick,250);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')tick();});
    return()=>{clearInterval(id);subscription.remove();};
  },[]);
  return now;
}
/*
 * Physical feedback. None of these may ever interrupt a workout, so every
 * failure (no vibrator, haptics switched off in system settings) is ignored.
 */
const feedback = {
  /** Light tick for small adjustments such as weight steps. */
  tick: () => { Haptics.selectionAsync().catch(() => {}); },
  /** Firm tap when a set is completed or the next one starts. */
  tap: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  /** Rest is over: long enough to feel with the phone in a pocket or on the bench. */
  restOver: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { Vibration.vibrate([0, 250, 120, 250]); } catch { /* no vibrator */ }
  },
};
const KEEP_AWAKE_TAG = 'nomosfit-workout';

function Chip({ title, label, color, onPress }: { title: string; label: string; color: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  // Static style arrays only: NativeWind v4 may swallow Pressable style callbacks.
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={[s.chip, pressed && s.chipPressed]}>
    <T style={[s.chipText, { color }]}>{title}</T>
  </Pressable>;
}

/**
 * Weight with big tap targets. Tap the number to type an exact value,
 * so a large jump does not need dozens of taps.
 */
function WeightControl({ label, value, onAdjust, onSet, compact = false }: { label: string; value: number; onAdjust: (delta: number) => void; onSet: (value: number) => void; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const open = () => { setDraft(String(value)); setError(''); setEditing(true); };
  const save = () => {
    const parsed = Number(draft.replace(',', '.').trim());
    if (!draft.trim() || !Number.isFinite(parsed) || parsed < 0 || parsed > 2000) { setError('Enter a weight from 0 to 2000 kg.'); return; }
    onSet(parsed); setEditing(false);
  };
  return <View style={[s.weightBlock, compact && s.weightBlockCompact]}>
    <View style={compact ? s.weightHeadCompact : s.weightHead}>
      <T style={s.blockLabel}>{label.toUpperCase()}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${value.toFixed(1)} kilograms. Tap to type a value.`} onPress={open} style={[s.weightValueRow, compact && s.weightValueRowCompact]}>
        <T style={[s.weightValue, compact && s.weightValueCompact]}>{value.toFixed(1)}</T><T style={s.weightUnit}>kg</T>
        <Ionicons name="create-outline" size={18} color={colors.muted} style={{ marginLeft: 10 }} />
      </Pressable>
    </View>
    <View style={s.chipRow}>
      <Chip title="−2.5" color={colors.red} label={`Decrease ${label} by 2.5 kilograms`} onPress={() => { feedback.tick(); onAdjust(-2.5); }} />
      <Chip title="−0.5" color={colors.red} label={`Decrease ${label} by 0.5 kilograms`} onPress={() => { feedback.tick(); onAdjust(-.5); }} />
      <Chip title="+0.5" color={colors.green} label={`Increase ${label} by 0.5 kilograms`} onPress={() => { feedback.tick(); onAdjust(.5); }} />
      <Chip title="+2.5" color={colors.green} label={`Increase ${label} by 2.5 kilograms`} onPress={() => { feedback.tick(); onAdjust(2.5); }} />
    </View>
    <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
      {/* Anchored near the top so the keyboard never covers the field. */}
      <View style={s.modalBackdrop}><View style={common.panel}>
        <T style={s.modalTitle}>{label.toUpperCase()}</T>
        <Field dark accessibilityLabel={`${label} in kilograms`} value={draft} onChangeText={text => { setDraft(text); setError(''); }}
          keyboardType="decimal-pad" autoFocus selectTextOnFocus returnKeyType="done" onSubmitEditing={save} maxLength={7} placeholder="kg" />
        <T style={s.modalHint}>{error || 'Saved to the nearest 0.5 kg.'}</T>
        <View style={s.modalActions}>
          <Button title="CANCEL" secondary onPress={() => setEditing(false)} style={s.modalButton} />
          <Button title="SET WEIGHT" onPress={save} style={s.modalButton} />
        </View>
      </View></View>
    </Modal>
  </View>;
}

/** Bar that glides to its new width instead of jumping. */
function Bar({ value, color = colors.green, reduced }: { value: number; color?: string; reduced: boolean }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const width = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    if (reduced) { width.setValue(clamped); return; }
    const run = Animated.timing(width, { toValue: clamped, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    run.start(); return () => run.stop();
  }, [clamped, reduced, width]);
  return <View style={s.bar}><Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} /></View>;
}
export function WorkoutScreen({navigation}:RootProps<'Workout'>) {
  const repPicker = useRef<RepPickerHandle>(null);
  const workout=useWorkoutStore(state=>state.workout);
  const sessions=useWorkoutHistoryStore(state=>state.sessions);
  const presentation=useWorkoutPresentation(state=>state.settings);
  const now=useClock();
  const {width}=useWindowDimensions();
  const saving=useRef(false), mounted=useRef(true), exiting=useRef(false), alertOpen=useRef(false);
  const [saveError,setSaveError]=useState('');
  const [isSaving,setIsSaving]=useState(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);

  const saveFinished=useCallback(async()=>{
    const finished=useWorkoutStore.getState().workout;
    if(!finished||finished.status!=='finished'||saving.current||exiting.current) return;
    const uid=auth.currentUser?.uid;
    saving.current=true;setIsSaving(true);setSaveError('');
    try{
      const session=await useWorkoutHistoryStore.getState().saveFinishedWorkout(finished);
      if(!mounted.current||auth.currentUser?.uid!==uid) return;
      // Local history succeeds first. Team networking must never block completion offline.
      void publishTeamWorkoutActivity(session).catch(()=>{/* Existing best-effort team behavior. */});
      exiting.current=true;
      useWorkoutStore.getState().resetWorkout();
      useWorkoutPresentation.getState().set(null);
      navigation.replace('AfterWorkout',{sessionId:session.id});
    }catch(err){
      if(mounted.current){setSaveError(err instanceof Error?err.message:'Workout could not be saved. Retry without losing it.');saving.current=false;setIsSaving(false);}
    }
  },[navigation]);
  useEffect(()=>{if(workout?.status==='finished')void saveFinished();},[workout?.id,workout?.status,saveFinished]);

  const exit=useCallback(()=>{
    if(saving.current||exiting.current||alertOpen.current)return;
    const current=useWorkoutStore.getState().workout;
    if(current?.status==='finished'){Alert.alert('Save your workout','Retry saving before leaving this screen.');return;}
    alertOpen.current=true;
    Alert.alert('Exit workout?','This unfinished workout will be discarded. Your programs and saved history will not change.',[
      {text:'Cancel',style:'cancel',onPress:()=>{alertOpen.current=false;}},
      {text:'Exit',style:'destructive',onPress:()=>{alertOpen.current=false;exiting.current=true;useWorkoutStore.getState().resetWorkout();useWorkoutPresentation.getState().set(null);navigation.goBack();}},
    ],{cancelable:true,onDismiss:()=>{alertOpen.current=false;}});
  },[navigation]);
  useFocusEffect(useCallback(()=>{
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{exit();return true;});return()=>sub.remove();
  },[exit]));

  const reduced=useReducedMotion();
  const insets=useSafeAreaInsets();
  const {height}=useWindowDimensions();
  // Fade the body in whenever the step changes (set -> rest -> next set).
  const stepKey=workout?`${workout.currentExerciseIndex}:${workout.currentSetIndex}:${workout.rest?'rest':'set'}`:'none';
  const fade=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    if(reduced){fade.setValue(1);return;}
    fade.setValue(0);
    const run=Animated.timing(fade,{toValue:1,duration:220,easing:Easing.out(Easing.quad),useNativeDriver:true});
    run.start();return()=>run.stop();
  },[stepKey,reduced,fade]);
  // Keep the screen on while this screen is open, so the timer stays visible between sets.
  useEffect(()=>{
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(()=>{});
    return()=>{deactivateKeepAwake(KEEP_AWAKE_TAG).catch(()=>{});};
  },[]);
  // Buzz once when a rest reaches zero, so the phone can stay in a pocket or on the bench.
  const restStartedAt=workout?.rest?.startedAt??null;
  const restLeft=workout?.rest?Math.max(0,workout.rest.durationSeconds-Math.floor((now-workout.rest.startedAt)/1000)):null;
  const buzzedFor=useRef<number|null>(null);
  useEffect(()=>{
    if(restStartedAt===null||restLeft===null||restLeft>0||buzzedFor.current===restStartedAt)return;
    buzzedFor.current=restStartedAt;feedback.restOver();
  },[restStartedAt,restLeft]);

  // Hooks above are unconditional, including during completion and an empty store.
  if(!workout) return <Screen><Notice message={exiting.current?'Opening workout summary…':'No workout is active.'}/>{!exiting.current&&<Button title="Back to Home" onPress={()=>navigation.navigate('Main',{screen:'Home'})}/>}</Screen>;
  if(workout.status==='finished') return <Screen contentStyle={{justifyContent:'center'}}><Brand size={Math.min(width*.7,290)}/><Notice message={saveError||'Saving your workout…'} retry={saveError?()=>{void saveFinished();}:undefined}/></Screen>;
  const exercise=workout.exercises[workout.currentExerciseIndex];
  if(!exercise)return <Screen><Notice message="The current exercise could not be found."/><Button title="Exit workout" onPress={exit}/></Screen>;
  const rest=workout.rest;
  const elapsed=Math.max(0,Math.floor((now-workout.startedAt)/1000));
  const remaining=rest?Math.max(0,rest.durationSeconds-Math.floor((now-rest.startedAt)/1000)):0;
  const previous=sessions.find(session=>session.programId===workout.programId);
  const lastSet=[...workout.completedSets].reverse().find(set=>set.exerciseId===exercise.id);
  const lastWorkoutSet=previous?.completedSets.find(set=>set.exerciseId===exercise.id&&set.setNumber===workout.currentSetIndex+1);
  const totalSets=workout.exercises.reduce((sum,ex)=>sum+ex.totalSets,0);
  const doneSets=workout.completedSets.length+(rest?1:0);
  const lastSetOfExercise=workout.currentSetIndex>=exercise.totalSets-1;
  const finalSet=workout.currentExerciseIndex===workout.exercises.length-1&&lastSetOfExercise;
  // During rest the indexes still point at the set that was just performed.
  const upNext=finalSet?null:lastSetOfExercise
    ?{exercise:workout.exercises[workout.currentExerciseIndex+1],setNumber:1}
    :{exercise,setNumber:workout.currentSetIndex+2};
  const goal=(target:number)=>`${repLabel(presentation.mode,target)} reps`;
  const setLine=(set?:{reps:number;weight:number})=>set?`${set.reps} reps × ${set.weight.toFixed(1)} kg`:'—';
  const completeSet = () => { feedback.tap(); beginProgramRest(); };
  const completeRest = () => {
    // Read the currently centered number even if a fling just ended.
    const state = useWorkoutStore.getState();
    if (!state.workout?.rest) return;
    if (repPicker.current) state.setRestReps(repPicker.current.getValue());
    feedback.tap();
    useWorkoutStore.getState().finishRest();
  };
  const ready=!!rest&&remaining===0;
  const restAction=finalSet?'FINISH WORKOUT':remaining>0?'SKIP REST':upNext?.setNumber===1?'START NEXT EXERCISE':'START NEXT SET';
  // The emblem is brand decoration: show it small, and only when there is room.
  const showEmblem=!rest&&height>=760;
  return <Screen scroll={false} contentStyle={{paddingBottom:0}}>
    <View style={s.workoutHeader}>
      <IconButton icon="close" color={colors.green} label="Exit workout" onPress={exit} style={{marginLeft:-12}}/>
      <T numberOfLines={1} style={s.programName}>{workout.programName.toUpperCase()}</T>
      <View accessible accessibilityLabel={`Workout time ${formatTime(elapsed)}`} style={s.clock}>
        <Ionicons name="time-outline" size={16} color={colors.muted}/><T style={s.clockText}>{formatTime(elapsed)}</T>
      </View>
    </View>
    <Bar value={doneSets/Math.max(1,totalSets)} reduced={reduced}/>
    <T style={s.overall}>{doneSets} of {totalSets} sets done</T>

    <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
      <Animated.View style={{opacity:fade}}>
      {rest ? <>
        <T style={[s.eyebrow,ready&&{color:colors.white}]}>{ready?'READY':'REST'}</T>
        <T accessibilityLabel={ready?'Rest complete':`Rest, ${formatTime(remaining)} remaining`} style={[s.timer,ready&&{color:colors.green}]}>{formatTime(remaining)}</T>
        <Bar value={rest.durationSeconds>0?remaining/rest.durationSeconds:0} color={colors.muted} reduced={reduced}/>

        <View style={[common.panel,s.card]}>
          <T style={s.blockLabel}>JUST DONE</T>
          <T numberOfLines={2} style={s.cardTitle}>{exercise.name.toUpperCase()}</T>
          <T style={s.cardMeta}>Set {workout.currentSetIndex+1} of {exercise.totalSets} · {exercise.workingWeight.toFixed(1)} kg</T>
          <View style={s.pickerWrap}><RepPicker ref={repPicker} key={`${workout.id}:${rest.startedAt}:${rest.exerciseIndex}:${rest.setIndex}`} value={rest.reps} onChange={reps=>useWorkoutStore.getState().setRestReps(reps)}/></View>
        </View>

        {upNext?.exercise ? <View style={[common.panel,s.card]}>
          <T style={s.blockLabel}>UP NEXT</T>
          <T numberOfLines={2} style={s.cardTitle}>{upNext.exercise.name.toUpperCase()}</T>
          <T style={s.cardMeta}>Set {upNext.setNumber} of {upNext.exercise.totalSets} · Goal {goal(upNext.exercise.targetReps)}</T>
          <WeightControl compact label="Next weight" value={rest.nextWeight}
            onAdjust={delta=>useWorkoutStore.getState().adjustRestWeight(delta)}
            onSet={value=>useWorkoutStore.getState().setRestWeight(value)}/>
        </View> : <View style={[common.panel,s.card]}>
          <T style={s.blockLabel}>LAST SET DONE</T>
          <T style={s.cardMeta}>Check your reps above, then finish to save this workout.</T>
        </View>}
      </> : <>
        {showEmblem&&<View style={s.emblem}><Brand size={96}/></View>}
        <T style={s.eyebrow}>EXERCISE {workout.currentExerciseIndex+1} OF {workout.exercises.length}</T>
        <T numberOfLines={2} style={s.exerciseName}>{exercise.name.toUpperCase()}</T>

        <View style={s.statRow}>
          <View style={[common.panel,s.stat]}><T style={s.blockLabel}>SET</T><T style={s.statValue}>{workout.currentSetIndex+1}<T style={s.statOf}> / {exercise.totalSets}</T></T></View>
          <View style={[common.panel,s.stat]}><T style={s.blockLabel}>GOAL REPS</T><T numberOfLines={1} style={[s.statValue,{color:colors.green}]}>{repLabel(presentation.mode,exercise.targetReps)}</T></View>
        </View>

        <View style={[common.panel,s.card]}>
          <View style={s.refRow}><T style={s.refLabel}>Last set today</T><T style={s.refValue}>{setLine(lastSet)}</T></View>
          <View style={s.refDivider}/>
          <View style={s.refRow}><T style={s.refLabel}>Last workout, set {workout.currentSetIndex+1}</T><T style={s.refValue}>{setLine(lastWorkoutSet)}</T></View>
        </View>

        <View style={[common.panel,s.card]}>
          <WeightControl label="Working weight" value={exercise.workingWeight}
            onAdjust={delta=>useWorkoutStore.getState().adjustCurrentWeight(delta)}
            onSet={value=>useWorkoutStore.getState().setCurrentWeight(value)}/>
        </View>
      </>}
      </Animated.View>
    </ScrollView>

    {/* The main action stays under the thumb; it never scrolls away. */}
    <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)+8}]}>
      {rest
        ? <Button title={restAction} disabled={isSaving} onPress={completeRest}/>
        : <Button title="COMPLETE SET" onPress={completeSet}/>}
    </View>
  </Screen>;
}
/** How each exercise moved against the previous session of the same routine. */
function compareSessions(current: WorkoutSession, previous: WorkoutSession) {
  const before = summarizeSets(previous.completedSets);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const round = (n: number) => Math.round(n * 10) / 10;
  return summarizeSets(current.completedSets).map(row => {
    const old = before.find(item => item.id === row.id);
    if (!old) return { id: row.id, name: row.name, direction: 'new' as const, text: 'New' };
    const weight = round(Math.max(...row.weights) - Math.max(...old.weights));
    const reps = sum(row.reps) - sum(old.reps);
    const signed = (n: number, unit: string) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${unit}`;
    // Heavier beats more reps; reps decide when the top weight is the same.
    if (weight !== 0) return { id: row.id, name: row.name, direction: weight > 0 ? 'up' as const : 'down' as const, text: signed(weight, 'kg') };
    if (reps !== 0) return { id: row.id, name: row.name, direction: reps > 0 ? 'up' as const : 'down' as const, text: signed(reps, reps === 1 || reps === -1 ? 'rep' : 'reps') };
    return { id: row.id, name: row.name, direction: 'same' as const, text: 'Matched' };
  });
}

export function AfterWorkoutScreen({navigation,route}:RootProps<'AfterWorkout'>) {
  const sessions=useWorkoutHistoryStore(s=>s.sessions);
  const session=sessions.find(s=>s.id===route.params.sessionId);
  const insets=useSafeAreaInsets();
  const finish=useCallback(()=>navigation.reset({index:0,routes:[{name:'Main',params:{screen:'Home'}}]}),[navigation]);
  useFocusEffect(useCallback(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{finish();return true;});return()=>sub.remove();},[finish]));
  // One celebratory pulse when the summary appears.
  useEffect(()=>{Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});},[]);
  if(!session)return <Screen><Notice message="This workout summary is not available."/><Button title="Back to Home" onPress={finish}/></Screen>;
  const previous=previousSession(sessions,session);
  const stats=sessionStats(session);
  const changes=previous?compareSessions(session,previous):[];
  const improved=changes.filter(change=>change.direction==='up').length;
  const before=previous?sessionStats(previous):null;
  const delta=(now:number,then:number,unit:string)=>{
    const diff=Math.round((now-then)*10)/10;
    return diff===0?`Same ${unit} as last time`:`${diff>0?'+':'−'}${compactNumber(Math.abs(diff))} ${unit} vs last time`;
  };
  const headline=!previous?'First session recorded'
    :improved>0?`Improved on ${improved} ${improved===1?'exercise':'exercises'}`
    :changes.every(change=>change.direction==='same')?'Matched your last session'
    :'Session logged';
  return <Screen scroll={false} contentStyle={{paddingBottom:0}}>
    <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:24}}>
      <View style={a.top}>
        <View style={s.success}><Ionicons name="checkmark" color={colors.background} size={36}/></View>
        <T style={a.eyebrow}>WORKOUT COMPLETE</T>
        <T numberOfLines={2} style={a.title}>{session.programName.toUpperCase()}</T>
        <T style={a.headline}>{headline}</T>
      </View>

      <View style={a.grid}>
        <View style={[common.panel,a.stat]}><T style={a.statValue}>{formatTime(session.durationSeconds)}</T><T style={a.statLabel}>DURATION</T></View>
        <View style={[common.panel,a.stat]}><T style={a.statValue}>{stats.sets}</T><T style={a.statLabel}>SETS</T></View>
      </View>
      <View style={a.grid}>
        <View style={[common.panel,a.stat]}><T style={a.statValue}>{stats.reps}</T><T style={a.statLabel}>REPS</T></View>
        <View style={[common.panel,a.stat]}><T numberOfLines={1} adjustsFontSizeToFit style={a.statValue}>{compactNumber(stats.volume)}</T><T style={a.statLabel}>KG VOLUME</T></View>
      </View>

      <T style={a.section}>COMPARED WITH LAST TIME</T>
      {previous&&before ? <View style={common.panel}>
        <T style={a.compareLine}>{delta(stats.reps,before.reps,'reps')}</T>
        <T style={a.compareLine}>{delta(stats.volume,before.volume,'kg volume')}</T>
        <View style={a.divider}/>
        {changes.map(change=><View key={change.id} style={a.changeRow}>
          <Ionicons name={change.direction==='up'?'trending-up':change.direction==='down'?'trending-down':change.direction==='new'?'sparkles-outline':'remove'} size={18}
            color={change.direction==='up'?colors.green:colors.muted}/>
          <T numberOfLines={1} style={a.changeName}>{change.name}</T>
          <T style={[a.changeText,change.direction==='up'&&{color:colors.green}]}>{change.text}</T>
        </View>)}
        <T style={a.caption}>{`Compared with ${historyDate(previous.finishedAt)}. Top weight first, then total reps.`}</T>
      </View> : <View style={common.panel}>
        <T style={a.compareLine}>This is your baseline for {session.programName}.</T>
        <T style={a.caption}>Train it again and you will see what changed here.</T>
      </View>}

      <T style={a.section}>EVERY SET</T>
      <SessionTable session={session}/>
    </ScrollView>
    <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)+8}]}>
      <Button title="DONE" onPress={finish}/>
    </View>
  </Screen>;
}
const a=StyleSheet.create({
  top:{alignItems:'center',marginTop:8,marginBottom:22},
  eyebrow:{color:colors.green,fontSize:12,letterSpacing:1,marginTop:14},
  title:{fontFamily:fonts.heading,fontSize:24,lineHeight:30,textAlign:'center',marginTop:8},
  headline:{fontSize:15,color:colors.white,marginTop:10,textAlign:'center'},
  grid:{flexDirection:'row',gap:12,marginBottom:12},
  stat:{flex:1,alignItems:'center',paddingVertical:16},
  statValue:{fontFamily:fonts.heading,fontSize:26,lineHeight:32},
  statLabel:{fontSize:12,color:colors.muted,letterSpacing:1,marginTop:4},
  section:{fontSize:12,color:colors.muted,letterSpacing:1,marginTop:18,marginBottom:10},
  compareLine:{fontSize:15,marginBottom:6},
  divider:{height:1,backgroundColor:colors.border,marginVertical:10},
  changeRow:{flexDirection:'row',alignItems:'center',gap:10,minHeight:36},
  changeName:{flex:1,fontSize:14},
  changeText:{fontSize:14,color:colors.muted},
  caption:{fontSize:12,color:colors.muted,marginTop:8,lineHeight:17},
});
const s=StyleSheet.create({
  workoutHeader:{flexDirection:'row',alignItems:'center',gap:6,minHeight:44,marginBottom:12},
  programName:{fontFamily:fonts.heading,fontSize:16,flex:1},
  clock:{flexDirection:'row',alignItems:'center',gap:5},clockText:{fontSize:14,color:colors.muted},
  bar:{height:6,borderRadius:3,backgroundColor:colors.border,overflow:'hidden'},
  overall:{fontSize:12,color:colors.muted,marginTop:8},
  body:{paddingTop:22,paddingBottom:24},
  emblem:{alignItems:'center',marginBottom:14},
  eyebrow:{textAlign:'center',fontSize:12,color:colors.green,letterSpacing:1},
  exerciseName:{textAlign:'center',fontSize:26,lineHeight:32,fontFamily:fonts.heading,marginTop:8},
  timer:{textAlign:'center',fontSize:64,lineHeight:72,fontFamily:fonts.heading,marginTop:4,marginBottom:14},
  pickerWrap:{marginTop:-8,marginBottom:-24},
  statRow:{flexDirection:'row',gap:12,marginTop:22},
  stat:{flex:1,alignItems:'center',paddingVertical:14},
  statValue:{fontFamily:fonts.heading,fontSize:28,lineHeight:34,marginTop:4},
  statOf:{fontFamily:fonts.heading,fontSize:14,color:colors.muted},
  card:{marginTop:12},
  cardTitle:{fontFamily:fonts.heading,fontSize:18,lineHeight:24,marginTop:6},
  cardMeta:{fontSize:13,color:colors.muted,marginTop:6},
  blockLabel:{fontSize:12,color:colors.muted,letterSpacing:1},
  refRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  refLabel:{fontSize:13,color:colors.muted,flex:1},refValue:{fontSize:15,color:colors.white},
  refDivider:{height:1,backgroundColor:colors.border,marginVertical:12},
  weightBlock:{alignItems:'center'},weightBlockCompact:{marginTop:14,paddingTop:12,borderTopWidth:1,borderColor:colors.border,alignSelf:'stretch'},
  weightHead:{alignItems:'center'},weightHeadCompact:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',alignSelf:'stretch'},
  weightValueRow:{flexDirection:'row',alignItems:'baseline',justifyContent:'center',minHeight:56,paddingHorizontal:12,marginTop:4},
  weightValue:{fontFamily:fonts.heading,fontSize:40,lineHeight:48},weightValueCompact:{fontSize:26,lineHeight:32},weightValueRowCompact:{minHeight:48,marginTop:0,paddingHorizontal:0},
  weightUnit:{fontFamily:fonts.heading,fontSize:16,color:colors.muted,marginLeft:6},
  chipRow:{flexDirection:'row',gap:8,marginTop:10,alignSelf:'stretch'},
  chip:{flex:1,minHeight:48,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background,alignItems:'center',justifyContent:'center'},
  chipPressed:{opacity:.6},
  chipText:{fontFamily:fonts.heading,fontSize:15},
  footer:{paddingTop:12},
  modalBackdrop:{flex:1,justifyContent:'flex-start',paddingTop:110,paddingHorizontal:26,backgroundColor:'rgba(0,0,0,.82)'},
  modalTitle:{fontFamily:fonts.heading,fontSize:16,marginBottom:14},
  modalHint:{fontSize:12,color:colors.muted,marginTop:10},
  modalActions:{flexDirection:'row',gap:10,marginTop:16},
  modalButton:{flex:1,width:'auto'},
  success:{width:64,height:64,borderRadius:32,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'},
});
