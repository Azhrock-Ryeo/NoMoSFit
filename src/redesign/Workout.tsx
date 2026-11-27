/** @jsxImportSource react */
import { sessionStats } from './historyModel';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, BackHandler, Easing, Modal, Pressable, ScrollView, StyleSheet, Vibration, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { useWorkoutStore } from '../store/workoutStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { publishTeamWorkoutActivity } from '../services/teamActivityService';
import { Brand, Button, common, Field, IconButton, Notice, ProgressTable, Screen, SessionTable, T } from './ui';
import { useReducedMotion } from './motion';
import { colors, fonts } from './tokens';
import { formatTime, previousSession, repLabel } from './model';
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
/** Short buzz. Never let a vibration problem interrupt a workout. */
function buzz(pattern: number | number[]) { try { Vibration.vibrate(pattern); } catch { /* no vibrator */ } }

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
      <Chip title="−2.5" color={colors.red} label={`Decrease ${label} by 2.5 kilograms`} onPress={() => onAdjust(-2.5)} />
      <Chip title="−0.5" color={colors.red} label={`Decrease ${label} by 0.5 kilograms`} onPress={() => onAdjust(-.5)} />
      <Chip title="+0.5" color={colors.green} label={`Increase ${label} by 0.5 kilograms`} onPress={() => onAdjust(.5)} />
      <Chip title="+2.5" color={colors.green} label={`Increase ${label} by 2.5 kilograms`} onPress={() => onAdjust(2.5)} />
    </View>
    <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
      {/* Anchored near the top so the keyboard never covers the field. */}
      <View style={s.modalBackdrop}><View style={common.panel}>
        <T style={s.modalTitle}>{label.toUpperCase()}</T>
        <Field accessibilityLabel={`${label} in kilograms`} value={draft} onChangeText={text => { setDraft(text); setError(''); }}
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
  // Buzz once when a rest reaches zero, so the phone can stay in a pocket or on the bench.
  const restStartedAt=workout?.rest?.startedAt??null;
  const restLeft=workout?.rest?Math.max(0,workout.rest.durationSeconds-Math.floor((now-workout.rest.startedAt)/1000)):null;
  const buzzedFor=useRef<number|null>(null);
  useEffect(()=>{
    if(restStartedAt===null||restLeft===null||restLeft>0||buzzedFor.current===restStartedAt)return;
    buzzedFor.current=restStartedAt;buzz([0,250,120,250]);
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
  const completeSet = () => { buzz(20); beginProgramRest(); };
  const completeRest = () => {
    // Read the currently centered number even if a fling just ended.
    const state = useWorkoutStore.getState();
    if (!state.workout?.rest) return;
    if (repPicker.current) state.setRestReps(repPicker.current.getValue());
    buzz(20);
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
export function AfterWorkoutScreen({navigation,route}:RootProps<'AfterWorkout'>) {
  const sessions=useWorkoutHistoryStore(s=>s.sessions);
  const session=sessions.find(s=>s.id===route.params.sessionId);
  const finish=useCallback(()=>navigation.reset({index:0,routes:[{name:'Main',params:{screen:'Home'}}]}),[navigation]);
  useFocusEffect(useCallback(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{finish();return true;});return()=>sub.remove();},[finish]));
  if(!session)return <Screen><Notice message="This workout summary is not available."/><Button title="Back to Home" onPress={finish}/></Screen>;
  const previous=previousSession(sessions,session);
  return <Screen>
    <View style={{alignItems:'center',marginTop:18,marginBottom:28}}><View style={s.success}><Ionicons name="checkmark" color="white" size={36}/></View><T style={{color:colors.green,fontSize:10,marginTop:14}}>WORKOUT COMPLETE</T><T style={[common.section,{marginTop:9,marginBottom:7}]}>{session.programName.toUpperCase()}</T><T style={{fontSize:9,color:colors.muted}}>{new Date(session.finishedAt).toLocaleDateString()}</T></View>
    <View style={{borderWidth:2,borderColor:colors.green,backgroundColor:'#10231A',borderRadius:18,padding:16,marginBottom:14}}>
      <T style={{fontFamily:fonts.heading,fontSize:18,color:colors.green}}>JUST FINISHED</T>
      <T style={{fontSize:14,marginTop:10}}>{sessionStats(session).sets} completed sets · {sessionStats(session).reps} actual reps · {formatTime(session.durationSeconds)}</T>
      <T style={{color:colors.muted,fontSize:12,marginTop:8}}>Your current workout is below. Every set and rep has been kept for next week's comparison.</T>
    </View><SessionTable session={session} highlight/>
    <T style={common.section}>LAST WORKOUT</T>{previous?<SessionTable session={previous}/>:<Notice message="No previous session for this program yet."/>}
    <T style={common.section}>PROGRESSION</T><ProgressTable current={session} previous={previous}/>
    <Button title="BACK TO HOME" onPress={finish} style={{marginTop:30}}/>
  </Screen>;
}
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
