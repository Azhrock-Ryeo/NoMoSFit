import React from 'react';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import ProgramsScreen from '../screens/programs/ProgramsScreen';
import CreateProgramScreen from '../screens/programs/CreateProgramScreen';
import ProgramDetailScreen from '../screens/programs/ProgramDetailScreen';

const Stack = createNativeStackNavigator();

export default function ProgramsNavigator() {
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
        name="ProgramsList"
        component={ProgramsScreen}
      />

      <Stack.Screen
        name="ProgramDetail"
        component={ProgramDetailScreen}
      />

      <Stack.Screen
        name="CreateProgram"
        component={CreateProgramScreen}
      />
    </Stack.Navigator>
  );
}