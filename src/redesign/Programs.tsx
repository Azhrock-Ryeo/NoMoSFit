/** @jsxImportSource react */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppAlert as Alert } from './feedback';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useProgramStore } from '../store/programStore';
import { useAuthStore } from '../store/authStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { auth } from '../config/firebase';
import type { ProgramExercise, WorkoutCategory } from '../types/program';
import { Button, common, ExerciseTable, Field, Heading, IconButton, Notice, Screen, Stepper, T } from './ui';
import { colors, fonts } from './tokens';
import { createId, DAYS, normalizeExercises, normalizeSettings, PRESETS, programGoalRows, repLabel, type ProgramSettings, type TrainingMode } from './model';
import { settingsFor, useProgramSettings } from './preferences';
import TrainingSelector from './TrainingSelector';
import { confirmRemoveRoutine } from './routineActions';
import { formatTime } from './model';
import { historyDate, sessionStats } from './historyModel';
import { startProgram } from './startWorkout';
import { suggestExercises } from './exercises';
import { relinkToHistory } from './relink';
import { StarterRoutines, useStarterOffer } from './starters';
import type { ProgramProps, RootRoutes, Tabs } from './routes';

function useAccountPrograms(){
  const uid=useAuthStore(s=>s.user?.uid);
  const owner=useProgramStore(s=>s.ownerUid);
  const all=useProgramStore(s=>s.programs);
  return owner===uid&&!!uid?all:[];
}
export function HomeScreen({navigation}:BottomTabScreenProps<Tabs,'Home'>) {
  const programs=useAccountPrograms();
  const uid=useAuthStore(state=>state.user?.uid);
  const historyOwner=useWorkoutHistoryStore(state=>state.ownerUid);
  const allSessions=useWorkoutHistoryStore(state=>state.sessions);
  const sessions=historyOwner===uid&&uid?allSessions:[];
  const loading=useProgramStore(state=>state.isLoading);
  const error=useProgramStore(state=>state.error);
  const preferencesError=useProgramSettings(state=>state.error);
  const preferences=useProgramSettings(state=>state.values);
  const root=useNavigation<NativeStackNavigationProp<RootRoutes>>();
  const latest=[...sessions].sort((a,b)=>b.finishedAt-a.finishedAt)[0];
  return <Screen bottomInset={false} contentStyle={{paddingHorizontal:24}}>
    <View style={s.quickHeading}><View style={s.dot}/><T style={s.quickTitle}>QUICK START</T><IconButton icon="add-circle" label="Create workout" color={colors.green} onPress={()=>navigation.navigate('Programs',{screen:'ProgramEditor',params:{}})}/></View>
    <T style={{color:colors.muted,marginBottom:22}}>Choose a routine to train. Open its progress to compare your recorded workouts.</T>
    {latest&&<Pressable accessibilityRole="button" accessibilityLabel={`View last workout ${latest.programName}`} onPress={()=>navigation.navigate('History',{screen:'SessionDetail',params:{sessionId:latest.id}})} style={[s.quickCard,{borderColor:'#1C6440'}]}>
      <T style={{color:colors.green,fontSize:12}}>LAST COMPLETED WORKOUT</T><T style={{fontFamily:fonts.heading,fontSize:16,marginTop:8}}>{latest.programName}</T><T style={{color:colors.muted,marginTop:8}}>{historyDate(latest.finishedAt)} · {sessionStats(latest).sets} sets · {sessionStats(latest).reps} actual reps</T><T style={{color:colors.green,marginTop:12}}>View results →</T>
    </Pressable>}
    {loading&&<Notice message="Loading programs…"/>}
    {error&&<Notice message={error} retry={()=>{void useProgramStore.getState().loadPrograms();}}/>}
    {preferencesError&&<Notice message={preferencesError} retry={()=>{void useProgramSettings.getState().load();}}/>}
    {programs.map(program=>{
      const settings=normalizeSettings(preferences[program.id]);
      const count=sessions.filter(session=>session.programId===program.id).length;
      return <View key={program.id} style={s.quickCard}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}><T style={{fontFamily:fonts.heading,fontSize:16,flex:1}}>{program.name.toUpperCase()}</T>
          <IconButton icon="create-outline" label={`Edit ${program.name}`} onPress={()=>navigation.navigate('Programs',{screen:'ProgramEditor',params:{programId:program.id}})}/>
          <IconButton icon="trash-outline" label={`Remove ${program.name} routine, keep History`} color={colors.red} onPress={()=>confirmRemoveRoutine(program)}/></View>
        <T style={{color:colors.muted,marginTop:8}}>{program.exercises.length} exercises · {program.exercises.reduce((n,e)=>n+e.sets,0)} sets · {formatTime(settings.restSeconds)} rest</T>
        <T style={{color:colors.muted,fontSize:12,marginTop:6}}>{count} completed {count===1?'session':'sessions'} saved</T>
        <Button title="START WORKOUT" onPress={()=>startProgram(program,root)} style={{marginTop:18}}/>
        <Pressable accessibilityRole="button" accessibilityLabel={`See ${program.name} progress in workout history`} onPress={()=>navigation.navigate('History',{screen:'ProgramHistory',params:{programId:program.id}})} style={{minHeight:48,justifyContent:'center',alignItems:'center',marginTop:6}}><T style={{color:colors.green,textAlign:'center'}}>See progress in workout history →</T></Pressable>
      </View>;
    })}
    {!loading&&!error&&!programs.length&&<><Notice message="Create a workout routine to get started. Any previously completed History is still saved."/><Button title="Create workout" onPress={()=>navigation.navigate('Programs',{screen:'ProgramEditor',params:{}})}/><Button title="Open workout history" secondary style={{marginTop:12}} onPress={()=>navigation.navigate('History',{screen:'HistoryList'})}/></>}
  </Screen>;
}
export function ProgramsScreen({navigation}:ProgramProps<'ProgramsList'>) {
  const programs=useAccountPrograms();
  const settings=useProgramSettings(s=>s.values);
  const loading=useProgramStore(s=>s.isLoading);
  const error=useProgramStore(s=>s.error);
  const offerStarters=useStarterOffer(!loading&&!error&&programs.length===0);
  return <Screen bottomInset={false}>
    <Heading title="WORKOUT EDIT" right={<IconButton icon="add-circle" color={colors.green} label="Create workout" onPress={()=>navigation.navigate('ProgramEditor',{})}/>}/>
    {loading&&<Notice message="Loading programs…"/>}
    {error&&<Notice message={error} retry={()=>{void useProgramStore.getState().loadPrograms();}}/>}
    {programs.map(program=><View key={program.id} style={{marginBottom:20}}>
      <View style={s.programTop}><T style={{fontFamily:fonts.heading,fontSize:16,flex:1}}>{program.name.toUpperCase()}</T><IconButton icon="create" label={`Edit ${program.name}`} color={colors.green} onPress={()=>navigation.navigate('ProgramEditor',{programId:program.id})}/></View>
      <ExerciseTable compact rows={programGoalRows(program,normalizeSettings(settings[program.id]))}/><View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',paddingTop:6}}><Pressable accessibilityRole="button" onPress={()=>confirmRemoveRoutine(program)} style={{minHeight:44,paddingHorizontal:10,justifyContent:'center'}}><T style={{color:colors.red}}>Remove routine · keep History</T></Pressable></View>
    </View>)}
    {!loading&&!error&&!programs.length&&<><Notice message="No routines yet. Create your own or add a template below."/><Button title="CREATE WORKOUT" onPress={()=>navigation.navigate('ProgramEditor',{})}/></>}
    {offerStarters&&<StarterRoutines/>}
  </Screen>;
}
function blankExercise(mode:TrainingMode):ProgramExercise {return {id:createId('exercise'),name:'',sets:3,targetReps:mode==='CUSTOM'?8:PRESETS[mode].target};}
export function ProgramEditor({navigation,route}:ProgramProps<'ProgramEditor'>) {
  const programId=route.params?.programId;
  const programs=useAccountPrograms();
  const existing=programs.find(p=>p.id===programId);
  const [name,setName]=useState('');
  const [category,setCategory]=useState<WorkoutCategory>('PUSH');
  const [settings,setSettings]=useState<ProgramSettings>(()=>({mode:'STRENGTH',restSeconds:PRESETS.STRENGTH.defaultRestSeconds,initialWeights:{}}));
  const [exercises,setExercises]=useState<ProgramExercise[]>(()=>[blankExercise('STRENGTH')]);
  const [dayMenu,setDayMenu]=useState(false);
  const [custom,setCustom]=useState(false);
  const [minutes,setMinutes]=useState('5');
  const [seconds,setSeconds]=useState('0');
  const [customReps,setCustomReps]=useState('8');
  const [saving,setSaving]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [numberEditor,setNumberEditor]=useState<{id:string;kind:'sets'|'reps'|'weight';value:string}|null>(null);
  // Names you already use, most recent History first, offered while typing.
  const [focusedExercise,setFocusedExercise]=useState<string|null>(null);
  const historySessions=useWorkoutHistoryStore(state=>state.sessions);
  const yourExercises=React.useMemo(()=>[...historySessions.flatMap(session=>session.completedSets.map(set=>set.exerciseName)),...programs.flatMap(program=>program.exercises.map(e=>e.name))],[historySessions,programs]);
  const initialized=useRef(false);
  const persistedId=useRef<string|undefined>(programId);
  const draftId=useRef(programId??createId());
  const savedOnce=useRef(false);
  const savingRef=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const settingsLoaded=useProgramSettings(s=>s.loaded);
  const settingsError=useProgramSettings(s=>s.error);
  useEffect(()=>{
    if(initialized.current||!settingsLoaded) return;
    if(existing){setName(existing.name);setCategory(existing.category);setSettings(settingsFor(existing.id));setExercises(existing.exercises.map(e=>({...e})));initialized.current=true;}
    else if(!programId) initialized.current=true;
  },[existing,programId,settingsLoaded]);
  const update=(id:string,change:Partial<ProgramExercise>)=>setExercises(all=>all.map(e=>e.id===id?{...e,...change}:e));
  const changeMode=(mode:keyof typeof PRESETS)=>{
    setSettings(v=>({...v,mode,restSeconds:PRESETS[mode].defaultRestSeconds}));setExercises(all=>all.map(e=>({...e,targetReps:PRESETS[mode].target})));
  };
  const openCustom=()=>{setMinutes(String(Math.floor(settings.restSeconds/60)));setSeconds(String(settings.restSeconds%60));setCustomReps(String(exercises[0]?.targetReps??8));setCustom(true);};
  const saveCustom=()=>{
    if(!/^\d{1,2}$/.test(minutes)||!/^\d{1,2}$/.test(seconds)||!/^\d{1,3}$/.test(customReps)){Alert.alert('Custom settings','Enter whole numbers for minutes, seconds, and reps.');return;}
    const m=Number(minutes),sec=Number(seconds),reps=Number(customReps),total=m*60+sec;
    if(sec>59||total<1||total>3600||reps<1||reps>100){Alert.alert('Custom settings','Use 1–3600 seconds in total, 0–59 in the seconds field, and 1–100 reps.');return;}
    setSettings(v=>({...v,mode:'CUSTOM',restSeconds:total}));setExercises(all=>all.map(e=>({...e,targetReps:reps})));setCustom(false);
  };
  const save=async()=>{
    if(savingRef.current||savedOnce.current)return;
    const owner=auth.currentUser?.uid;
    if(!owner){Alert.alert('Sign in','Sign in before saving.');return;}
    if(!name.trim()){Alert.alert('Choose your day','Choose a day or enter a workout name.');return;}
    if(exercises.some(e=>!e.name.trim())){Alert.alert('Exercise name','Name each exercise or remove the empty card.');return;}
    if(!settingsLoaded||settingsError){Alert.alert('Training settings',settingsError??'Settings are still loading.');return;}
    savingRef.current=true;setSaving(true);
    try {
      let cleaned=normalizeExercises(exercises,settings.mode);
      let savedSettings=settings;
      if(!persistedId.current){
        // Same name as a removed routine that still has History: continue that History.
        const link=relinkToHistory(name,cleaned,historySessions,programs);
        if(link.programId){
          draftId.current=link.programId;cleaned=link.exercises;
          savedSettings={...settings,initialWeights:Object.fromEntries(Object.entries(settings.initialWeights).map(([id,kg])=>[link.renamed[id]??id,kg]))};
        }
      }
      const input={name:name.trim(),category,targetMuscles:existing?.targetMuscles??[],exercises:cleaned};
      if(persistedId.current) await useProgramStore.getState().editProgram(persistedId.current,input);
      else {const result=await useProgramStore.getState().addProgram({...input,id:draftId.current});persistedId.current=result.id;}
      if(auth.currentUser?.uid!==owner||!mounted.current)return;
      // Retry uses persistedId, never creates a duplicate if this second write fails.
      await useProgramSettings.getState().save(persistedId.current!,savedSettings);
      if(auth.currentUser?.uid!==owner||!mounted.current)return;
      savedOnce.current=true;navigation.goBack();
    } catch(err){if(auth.currentUser?.uid===owner&&mounted.current)Alert.alert('Save not complete',`${err instanceof Error?err.message:'Unable to save.'}\nRetrying will not create a duplicate program.`);}
    finally{savingRef.current=false;if(mounted.current)setSaving(false);}
  };
  const remove=()=>{if(existing)confirmRemoveRoutine(existing,()=>{if(mounted.current)navigation.goBack();});};
  const reorder=(index:number,delta:number)=>setExercises(all=>{const j=index+delta;if(j<0||j>=all.length)return all;const result=[...all];[result[index],result[j]]=[result[j],result[index]];return result;});

  const applyNumber=()=>{
    if(!numberEditor)return;
    const n=Number(numberEditor.value);
    if(!numberEditor.value.trim()||!Number.isFinite(n)||n<0){Alert.alert('Invalid number','Enter a valid number.');return;}
    if(numberEditor.kind==='weight'){
      if(n>2000){Alert.alert('Weight','Enter a weight from 0 to 2000 kg.');return;}
      setSettings(v=>({...v,initialWeights:{...v.initialWeights,[numberEditor.id]:Math.round(n*2)/2}}));
    }else{
      const max=numberEditor.kind==='sets'?20:100;
      if(!Number.isInteger(n)||n<1||n>max){Alert.alert('Invalid number',`Choose a whole number from 1 to ${max}.`);return;}
      if(numberEditor.kind==='reps'&&settings.mode!=='CUSTOM')return;
      update(numberEditor.id,numberEditor.kind==='sets'?{sets:n}:{targetReps:n});
    }
    setNumberEditor(null);
  };
  return <Screen bottomInset={false} scrollEnabled={!dragging} contentStyle={dragging?{overflow:'visible'}:undefined}>
    <Heading title={programId?'EDIT WORKOUT':'CREATE WORKOUT'} onBack={()=>navigation.goBack()}/>
    <T style={{fontSize:12,color:colors.muted,lineHeight:18,marginBottom:18}}>Choose a day, select a training style, then add your exercises. Sets and weight are always editable.</T>
    {programId&&!existing ? <Notice message="This program is no longer available."/> : <>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose workout day" onPress={()=>setDayMenu(true)} style={s.daySelect}><T numberOfLines={1} style={{fontSize:15,color:name?colors.white:colors.faint,flex:1}}>{name||'CHOOSE YOUR DAY'}</T><Ionicons name="chevron-down" size={22} color={colors.muted}/></Pressable>
      <TrainingSelector mode={settings.mode} rest={settings.restSeconds} onChoose={changeMode} onCustom={openCustom} onGesture={setDragging}/>
      {settingsError&&<Notice message={settingsError} retry={()=>{void useProgramSettings.getState().load();}}/>}
      <View style={s.editorActions}><IconButton icon="remove-circle" color={colors.red} label="Remove last exercise" disabled={exercises.length<2} onPress={()=>setExercises(all=>all.length>1?all.slice(0,-1):all)}/><IconButton icon="add-circle" color={colors.green} label="Add exercise" onPress={()=>setExercises(all=>[...all,blankExercise(settings.mode)])}/></View>
      {exercises.map((exercise,index)=><View key={exercise.id} style={[common.panel,{marginBottom:18}]}>
        <View style={{flexDirection:'row',alignItems:'center'}}><T style={{fontSize:18,fontFamily:fonts.heading,flex:1}}>EXERCISE {index+1}</T><IconButton icon="arrow-up" label="Move exercise up" disabled={index===0} onPress={()=>reorder(index,-1)} style={{width:32}}/><IconButton icon="arrow-down" label="Move exercise down" disabled={index===exercises.length-1} onPress={()=>reorder(index,1)} style={{width:32}}/></View>
        <View style={{marginTop:8,marginBottom:18}}><Field dark accessibilityLabel={`Exercise ${index+1} name`} placeholder="Exercise name" value={exercise.name} onChangeText={name=>update(exercise.id,{name})} onFocus={()=>setFocusedExercise(exercise.id)} autoCapitalize="words" maxLength={60} style={{fontSize:15,minHeight:46}}/>
          {focusedExercise===exercise.id&&suggestExercises(exercise.name,yourExercises).length>0&&<View style={s.suggestions}>{suggestExercises(exercise.name,yourExercises).map(option=><Pressable key={option} accessibilityRole="button" accessibilityLabel={`Use ${option}`} onPress={()=>update(exercise.id,{name:option})} style={s.suggestion}><T style={s.suggestionText}>{option}</T></Pressable>)}</View>}</View>
        <View style={s.metrics}>
          <View style={{flex:1}}><T style={s.metricLabel}>{settings.mode==='CUSTOM'?'REPS':'REPS · LOCKED'}</T>
            {settings.mode==='CUSTOM'?<Pressable accessibilityRole="button" accessibilityLabel={`Edit ${exercise.name} target reps`} onPress={()=>setNumberEditor({id:exercise.id,kind:'reps',value:String(exercise.targetReps)})} style={s.valueHit}><T style={s.metricValue}>{exercise.targetReps}x</T></Pressable>:<View style={s.valueHit}><T style={s.metricValue}>{repLabel(settings.mode,exercise.targetReps)}x</T></View>}
          </View>
          <View style={{flex:1}}><T style={s.metricLabel}>SETS</T><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${exercise.name} sets`} onPress={()=>setNumberEditor({id:exercise.id,kind:'sets',value:String(exercise.sets)})} style={s.valueHit}><T style={s.metricValue}>{exercise.sets}x</T></Pressable></View>
          <View style={{flex:1}}><T style={s.metricLabel}>START KG</T><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${exercise.name} starting weight`} onPress={()=>setNumberEditor({id:exercise.id,kind:'weight',value:String(settings.initialWeights[exercise.id]??0)})} style={s.valueHit}><T style={s.metricValue}>{settings.initialWeights[exercise.id]??0}kg</T></Pressable></View>
        </View>
        <T style={{fontSize:10,color:colors.muted,lineHeight:16,marginTop:8}}>{settings.mode==='CUSTOM'?'Tap reps, sets or starting weight to edit.':'Tap sets or starting weight to edit. Use Customize to change target reps.'}</T>
        {exercises.length>1&&<Pressable onPress={()=>setExercises(all=>all.filter(e=>e.id!==exercise.id))} style={s.remove}><T style={{color:colors.red,fontSize:10}}>Remove exercise</T></Pressable>}
      </View>)}
      <Button title={programId?"SAVE CHANGES":"SAVE WORKOUT"} onPress={save} loading={saving}/>
      {programId&&<Button title="REMOVE ROUTINE · KEEP HISTORY" secondary onPress={remove} disabled={saving} style={{marginTop:18}}/>}
    </>}
    <Modal visible={numberEditor!==null} transparent animationType="fade" onRequestClose={()=>setNumberEditor(null)}><View style={s.modalBackdrop}><View style={common.panel}>
      <T style={common.section}>{numberEditor?.kind==='weight'?'STARTING WEIGHT (KG)':numberEditor?.kind==='sets'?'WORKING SETS':'CUSTOM TARGET REPS'}</T>
      <Field dark accessibilityLabel="Value" keyboardType={numberEditor?.kind==='weight'?'decimal-pad':'number-pad'} value={numberEditor?.value??''} onChangeText={value=>setNumberEditor(current=>current?{...current,value}:null)} selectTextOnFocus maxLength={8}/>
      <Button title="APPLY" onPress={applyNumber} style={{marginTop:20}}/><Button title="CANCEL" secondary onPress={()=>setNumberEditor(null)} style={{marginTop:12}}/>
    </View></View></Modal>
    <Modal visible={dayMenu} transparent animationType="fade" onRequestClose={()=>setDayMenu(false)}><View style={s.modalBackdrop}><View style={s.dayMenu}>
      <View style={{flexDirection:'row',alignItems:'center'}}><T style={{fontFamily:fonts.heading,fontSize:16,flex:1}}>CHOOSE YOUR DAY</T><IconButton icon="close" label="Close day picker" color={colors.muted} onPress={()=>setDayMenu(false)}/></View>
      {DAYS.map(day=><Pressable key={day.name} onPress={()=>{setName(day.name);setCategory(day.category);setDayMenu(false);}} style={s.dayOption}><T style={{fontSize:16}}>{day.name}</T></Pressable>)}
      <T style={{fontSize:12,color:colors.muted,marginTop:16,marginBottom:8}}>Or name your own workout</T><TextInput accessibilityLabel="Custom workout name" value={name} onChangeText={setName} maxLength={50} placeholder="e.g. Upper body" placeholderTextColor={colors.faint} selectionColor={colors.green} style={s.customName}/><Button title="USE NAME" onPress={()=>setDayMenu(false)} style={{marginTop:12}}/>
    </View></View></Modal>
    <Modal visible={custom} transparent animationType="fade" onRequestClose={()=>setCustom(false)}><View style={s.modalBackdrop}><View style={common.panel}>
      <T style={common.section}>CUSTOM REPS + REST</T><T style={{fontSize:11,color:colors.muted,lineHeight:18,marginBottom:18}}>Only Custom unlocks manual target reps. These values apply to this program; you can adjust each exercise’s reps afterwards.</T>
      <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><T style={s.metricLabel}>MINUTES</T><Field dark accessibilityLabel="Rest minutes" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} maxLength={2}/></View><View style={{flex:1}}><T style={s.metricLabel}>SECONDS</T><Field dark accessibilityLabel="Rest seconds" keyboardType="number-pad" value={seconds} onChangeText={setSeconds} maxLength={2}/></View></View>
      <T style={[s.metricLabel,{marginTop:16}]}>TARGET REPS</T><Field dark accessibilityLabel="Custom target reps" keyboardType="number-pad" value={customReps} onChangeText={setCustomReps} maxLength={3}/>
      <Button title="APPLY CUSTOM SETTINGS" onPress={saveCustom} style={{marginTop:22}}/><Button title="CANCEL" onPress={()=>setCustom(false)} secondary style={{marginTop:12}}/>
    </View></View></Modal>
  </Screen>;
}
const s=StyleSheet.create({
  quickHeading:{flexDirection:'row',alignItems:'center',gap:24,minHeight:44,marginBottom:22},dot:{width:22,height:22,borderRadius:11,backgroundColor:colors.green},quickTitle:{fontFamily:fonts.heading,fontSize:18},
  quickCard:{backgroundColor:colors.panel,borderRadius:15,padding:16,borderWidth:1,borderColor:colors.border,marginBottom:16},quickLine:{height:1,backgroundColor:colors.border,marginVertical:7},quickHint:{fontSize:8,color:colors.green,lineHeight:13},
  programTop:{flexDirection:'row',alignItems:'center',backgroundColor:colors.panel,borderTopLeftRadius:12,borderTopRightRadius:12,paddingHorizontal:18,paddingTop:8},
  daySelect:{flexDirection:'row',alignItems:'center',gap:8,minHeight:48,borderRadius:14,backgroundColor:'#12151C',borderWidth:1,borderColor:colors.border,paddingHorizontal:16},
  editorActions:{flexDirection:'row',justifyContent:'flex-end'},metrics:{flexDirection:'row',gap:12},metricLabel:{fontSize:9,color:colors.muted,marginBottom:8},metricValue:{fontSize:17,color:colors.green},valueHit:{minHeight:44,justifyContent:'center'},
  remove:{alignSelf:'flex-end',minHeight:40,justifyContent:'center'},
  suggestions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},suggestion:{minHeight:36,justifyContent:'center',paddingHorizontal:12,borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:'#12151C'},suggestionText:{fontSize:13,color:colors.green},
  modalBackdrop:{flex:1,justifyContent:'center',paddingHorizontal:26,backgroundColor:'rgba(0,0,0,.82)'},dayMenu:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,padding:20,borderRadius:18},dayOption:{borderBottomWidth:1,borderColor:colors.border,minHeight:48,justifyContent:'center'},customName:{borderWidth:1,borderColor:colors.border,backgroundColor:'#12151C',padding:12,borderRadius:12,color:colors.white,fontFamily:fonts.body},
});
