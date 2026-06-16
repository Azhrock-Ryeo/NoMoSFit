import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BeforeWorkoutScreen from "../screens/workout/BeforeWorkoutScreen";
import DuringWorkoutScreen from "../screens/workout/DuringWorkoutScreen";
import AfterWorkoutScreen from "../screens/workout/AfterWorkoutScreen";

const Stack = createNativeStackNavigator();

export default function WorkoutNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BeforeWorkout"
        component={BeforeWorkoutScreen}
      />
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