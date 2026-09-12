import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProgramsScreen from '../screens/programs/ProgramsScreen';
import CreateProgramScreen from '../screens/programs/CreateProgramScreen';

const Stack = createNativeStackNavigator();

export default function ProgramsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="ProgramsList"
        component={ProgramsScreen}
      />

      <Stack.Screen
        name="CreateProgram"
        component={CreateProgramScreen}
      />
    </Stack.Navigator>
  );
}