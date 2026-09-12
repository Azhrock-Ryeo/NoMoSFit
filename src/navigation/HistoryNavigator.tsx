import React from 'react';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import HistoryScreen from '../screens/history/HistoryScreen';
import WorkoutDetailScreen from '../screens/history/WorkoutDetailScreen';

const Stack = createNativeStackNavigator();

export default function HistoryNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#050505',
        },
      }}
    >
      <Stack.Screen
        name="HistoryList"
        component={HistoryScreen}
      />

      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
      />
    </Stack.Navigator>
  );
}