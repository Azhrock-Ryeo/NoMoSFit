/** @jsxImportSource react */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Goldman_400Regular, Goldman_700Bold } from '@expo-google-fonts/goldman';
import { useAuthStore } from '../store/authStore';
import { useProgramStore } from '../store/programStore';
import { useWorkoutHistoryStore } from '../store/workoutHistoryStore';
import { useWorkoutStore } from '../store/workoutStore';
import TeamScreen from './team/TeamScreen';
import { AccountSettingsScreen, ProfileScreen } from './Profile';
import AuthFlow from './Auth';
import { HomeScreen, ProgramEditor, ProgramsScreen } from './Programs';
import { HistoryScreen, ProgramHistoryScreen, SessionDetailScreen } from './History';
import { AfterWorkoutScreen, WorkoutScreen } from './Workout';
import { LoadingScreen } from './ui';
import { colors, fonts } from './tokens';
import { useProgramSettings } from './preferences';
import { useWorkoutPresentation } from './startWorkout';
import type { HistoryRoutes, ProfileRoutes, ProgramRoutes, RootRoutes, Tabs } from './routes';

const Stack=createNativeStackNavigator<RootRoutes>();
const Tab=createBottomTabNavigator<Tabs>();
const Programs=createNativeStackNavigator<ProgramRoutes>();
const History=createNativeStackNavigator<HistoryRoutes>();
const Profile=createNativeStackNavigator<ProfileRoutes>();
const screenOptions={headerShown:false,contentStyle:{backgroundColor:colors.background}};
function ProgramsStack(){return <Programs.Navigator screenOptions={screenOptions}><Programs.Screen name="ProgramsList" component={ProgramsScreen}/><Programs.Screen name="ProgramEditor" component={ProgramEditor}/></Programs.Navigator>;}
function HistoryStack(){return <History.Navigator screenOptions={screenOptions}><History.Screen name="HistoryList" component={HistoryScreen}/><History.Screen name="ProgramHistory" component={ProgramHistoryScreen}/><History.Screen name="SessionDetail" component={SessionDetailScreen}/></History.Navigator>;}
function ProfileStack(){return <Profile.Navigator screenOptions={screenOptions}><Profile.Screen name="ProfileHome" component={ProfileScreen}/><Profile.Screen name="AccountSettings" component={AccountSettingsScreen}/></Profile.Navigator>;}
function MainTabs(){
  const inset=useSafeAreaInsets();
  return <Tab.Navigator initialRouteName="Home" screenOptions={({route})=>({
    headerShown:false,tabBarHideOnKeyboard:true,tabBarShowLabel:true,
    tabBarLabelStyle:{fontSize:12,fontFamily:fonts.body},
    tabBarActiveTintColor:colors.green,tabBarInactiveTintColor:'#676873',
    // Reserve the actual system-navigation inset; do not place icons behind it.
    tabBarStyle:{height:62+inset.bottom,paddingTop:4,paddingBottom:inset.bottom+4,backgroundColor:colors.bottom,borderTopColor:colors.border,borderTopWidth:1},
    tabBarAccessibilityLabel:route.name,
    tabBarIcon:({focused,color})=>{
      const icons:Record<keyof Tabs,keyof typeof Ionicons.glyphMap>={Home:focused?'home':'home-outline',Programs:focused?'barbell':'barbell-outline',History:focused?'time':'time-outline',Team:focused?'people':'people-outline',Profile:focused?'person':'person-outline'};
      return <Ionicons name={icons[route.name]} color={color} size={23}/>;
    },
  })}>
    <Tab.Screen name="Home" component={HomeScreen}/>
    <Tab.Screen name="Programs" component={ProgramsStack}/>
    <Tab.Screen name="History" component={HistoryStack}/>
    <Tab.Screen name="Team" component={TeamScreen}/>
    <Tab.Screen name="Profile" component={ProfileStack}/>
  </Tab.Navigator>;
}
const theme={...DarkTheme,colors:{...DarkTheme.colors,primary:colors.green,background:colors.background,card:colors.panel,text:colors.white,border:colors.border,notification:colors.green}};
export default function DesignNavigator(){
  const user=useAuthStore(state=>state.user);
  const loading=useAuthStore(state=>state.isLoading);
  const [fontsLoaded,fontError]=useFonts({Goldman_400Regular,Goldman_700Bold});
  const [registrationActive,setRegistrationActive]=useState(false);
  const done=useCallback(()=>setRegistrationActive(false),[]);
  const uid=user?.uid;
  useEffect(()=>{
    // Clear stale in-memory state on account change; persistent data stays UID-scoped.
    useWorkoutStore.getState().resetWorkout();useWorkoutPresentation.getState().set(null);
    useProgramSettings.getState().reset();
    useProgramStore.getState().resetProgramState();useWorkoutHistoryStore.getState().resetHistoryState();
    if(uid){void useProgramStore.getState().loadPrograms();void useWorkoutHistoryStore.getState().loadHistory();void useProgramSettings.getState().load();}
  },[uid]);
  if(fontError)return <View style={{flex:1,backgroundColor:colors.background,padding:32,justifyContent:'center'}}><Text style={{color:'white',fontSize:18}}>The Goldman font could not be loaded. Check that @expo-google-fonts/goldman is installed, then restart Metro with --clear.</Text><Text style={{color:'#AAA',marginTop:14}}>{fontError.message}</Text></View>;
  if(loading||!fontsLoaded)return <LoadingScreen/>;
  return <NavigationContainer theme={theme}>
    <Stack.Navigator key={user&&!registrationActive ? uid : 'auth'} screenOptions={{...screenOptions,animation:'slide_from_right'}}>
      {user&&!registrationActive?<>
        <Stack.Screen name="Main" component={MainTabs}/>
        <Stack.Screen name="Workout" component={WorkoutScreen} options={{gestureEnabled:false}}/>
        <Stack.Screen name="AfterWorkout" component={AfterWorkoutScreen} options={{gestureEnabled:false}}/>
      </>:<Stack.Screen name="Auth">{()=> <AuthFlow setRegistrationActive={setRegistrationActive} onDone={done}/>}</Stack.Screen>}
    </Stack.Navigator>
  </NavigationContainer>;
}
