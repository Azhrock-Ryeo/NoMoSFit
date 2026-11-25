/** @jsxImportSource react */
import { sessionStats } from './historyModel';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../config/firebase';
import { useWorkoutStore } from '../store/workoutStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { publishTeamWorkoutActivity } from '../services/teamActivityService';
import { Brand, Button, common, IconButton, Notice, ProgressTable, Screen, SessionTable, Stepper, T } from './ui';
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
  const progress=(workout.completedSets.length+(rest?1:0))/Math.max(1,totalSets);
  const finalSet=workout.currentExerciseIndex===workout.exercises.length-1&&workout.currentSetIndex===exercise.totalSets-1;
  const completeSet = () => beginProgramRest();
  const completeRest = () => {
    // Read the currently centered number even if a fling just ended.
    const state = useWorkoutStore.getState();
    if (!state.workout?.rest) return;
    if (repPicker.current) state.setRestReps(repPicker.current.getValue());
    useWorkoutStore.getState().finishRest();
  };
  return <Screen>
    <View style={s.workoutHeader}>
      <IconButton icon="close" color={colors.green} label="Exit workout" onPress={exit} style={{width:32,marginLeft:-8}}/>
      <T numberOfLines={1} style={s.programName}>{workout.programName.toUpperCase()}</T>
      <T style={s.headerMeta}>{repLabel(presentation.mode,exercise.targetReps)}x</T>
      <T style={s.headerMeta}>{workout.currentSetIndex+1}/{exercise.totalSets}</T>
      <T style={s.headerMeta}>{formatTime(elapsed)}</T>
    </View>
    <View style={s.topLine}/>
    <T style={s.eyebrow}>{rest?'REST':`EXERCISE ${workout.currentExerciseIndex+1} OF ${workout.exercises.length}`}</T>
    <T style={s.exerciseName}>{rest?formatTime(remaining):exercise.name.toUpperCase()}</T>
    <View style={{alignItems:'center',marginTop:28,marginBottom:28}}><Brand size={Math.min(width*.72,330)}/></View>
    <View style={s.progress}><View style={{width:`${Math.min(100,progress*100)}%`,height:4,backgroundColor:colors.green}}/></View>
    {rest ? <>
      <RepPicker ref={repPicker} key={`${workout.id}:${rest.startedAt}:${rest.exerciseIndex}:${rest.setIndex}`} value={rest.reps} onChange={reps=>useWorkoutStore.getState().setRestReps(reps)}/>
      <T style={s.smallLabel}>{finalSet?'LAST SET COMPLETED':'PREPARE NEXT WEIGHT'}</T>
      {!finalSet&&<View style={s.weight}><Stepper label="next weight" value={`${rest.nextWeight.toFixed(1)}kg`} onMinus={()=>useWorkoutStore.getState().adjustRestWeight(-.5)} onPlus={()=>useWorkoutStore.getState().adjustRestWeight(.5)}/></View>}
      <Button title={finalSet?'FINISH WORKOUT':remaining>0?'SKIP REST':'NEXT SET'} disabled={isSaving} onPress={completeRest} style={{marginTop:30}}/>
    </> : <>
      <View style={{marginTop:22,gap:12}}>
        <View style={s.repRow}><T style={s.repText}>Last <T style={[s.repText,{color:colors.green}]}>set</T> reps:</T><T style={s.repNumber}>{lastSet?`${lastSet.reps}x`:'—'}</T></View>
        <View style={s.repRow}><T style={s.repText}>Last <T style={[s.repText,{color:colors.green}]}>workout</T> reps:</T><T style={s.repNumber}>{lastWorkoutSet?`${lastWorkoutSet.reps}x`:'—'}</T></View>
        <View style={[s.repRow,{marginTop:18}]}><T style={s.goal}>GOAL REPS:</T><T style={s.goal}>{repLabel(presentation.mode,exercise.targetReps)}x</T></View>
      </View>
      <T style={[s.smallLabel,{marginTop:36}]}>WORKING WEIGHT · KG</T>
      <View style={s.weight}><Stepper label="weight" value={`${exercise.workingWeight.toFixed(1)}kg`} onMinus={()=>useWorkoutStore.getState().adjustCurrentWeight(-.5)} onPlus={()=>useWorkoutStore.getState().adjustCurrentWeight(.5)}/></View>
      <Button title="COMPLETE SET" onPress={completeSet} style={{marginTop:32}}/>
    </>}
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
  workoutHeader:{flexDirection:'row',alignItems:'center',gap:8},programName:{fontFamily:fonts.heading,fontSize:20,flex:1},headerMeta:{fontSize:9,color:colors.green},topLine:{height:1,backgroundColor:colors.border,marginVertical:14},
  eyebrow:{textAlign:'center',fontSize:10,color:colors.green,marginTop:4},exerciseName:{textAlign:'center',fontSize:22,fontFamily:fonts.heading,marginTop:14},progress:{height:4,backgroundColor:colors.border,marginHorizontal:16},
  smallLabel:{textAlign:'center',fontSize:9,color:colors.green,marginBottom:8},repRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},repText:{fontSize:17},repNumber:{fontSize:18,color:colors.green},goal:{fontSize:20,color:colors.green},weight:{alignSelf:'center',width:'78%'},
  repHit:{width:44,height:48,alignItems:'center',justifyContent:'center'},repCircle:{width:30,height:30,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:colors.panel},repSelected:{width:40,height:40,borderWidth:1,borderColor:colors.green},
  success:{width:64,height:64,borderRadius:32,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'},
});
