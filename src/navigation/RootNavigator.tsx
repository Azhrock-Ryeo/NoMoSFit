import React from 'react';
import AfterWorkoutScreen from '../screens/workout/AfterWorkoutScreen';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  DarkTheme,
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import LoginScreen from '../screens/auth/LoginScreen';

import MainTabNavigator from './MainTabNavigator';

import DuringWorkoutScreen from '../screens/workout/DuringWorkoutScreen';

import {
  useAuthStore,
} from '../store/authStore';

const Stack =
  createNativeStackNavigator();

const theme = {
  ...DarkTheme,

  colors: {
    ...DarkTheme.colors,

    primary: '#4ADE80',
    background: '#050505',
    card: '#0B0B0C',
    text: '#F9FAFB',
    border: '#18181B',
    notification: '#4ADE80',
  },
};

function LoadingScreen() {
  return (
    <View
      style={styles.loadingRoot}
    >
      <Text style={styles.logo}>
        NoMoS
      </Text>

      <Text
        style={styles.logoAccent}
      >
        FIT
      </Text>

      <ActivityIndicator
        size="large"
        color="#4ADE80"
        style={styles.spinner}
      />
    </View>
  );
}

export default function RootNavigator() {
  const user =
    useAuthStore(
      (state) =>
        state.user
    );

  const isLoading =
    useAuthStore(
      (state) =>
        state.isLoading
    );

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      theme={theme}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,

          contentStyle: {
            backgroundColor:
              '#050505',
          },

          animation:
            'slide_from_right',
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Main"
              component={
                MainTabNavigator
              }
            />

            <Stack.Screen
  name="Workout"
  component={DuringWorkoutScreen}
  options={{
    gestureEnabled: false,
  }}
/>

<Stack.Screen
  name="AfterWorkout"
  component={AfterWorkoutScreen}
  options={{
    gestureEnabled: false,
  }}
/>
            
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={
              LoginScreen
            }
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles =
  StyleSheet.create({
    loadingRoot: {
      flex: 1,
      backgroundColor: '#050505',
      alignItems: 'center',
      justifyContent: 'center',
    },

    logo: {
      color: '#F9FAFB',
      fontSize: 36,
      fontWeight: '900',
    },

    logoAccent: {
      color: '#4ADE80',
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 3,
      marginTop: -2,
    },

    spinner: {
      marginTop: 28,
    },
  });