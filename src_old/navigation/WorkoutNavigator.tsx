import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DuringWorkoutScreen from '../screens/workout/DuringWorkoutScreen';
import AfterWorkoutScreen from '../screens/workout/AfterWorkoutScreen';

const Stack = createNativeStackNavigator();

export default function WorkoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="DuringWorkout"
        component={DuringWorkoutScreen}
      />

      <Stack.Screen
        name="AfterWorkout"
        component={AfterWorkoutScreen}
      />
    </Stack.Navigator>
  );
}