import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TeamWorkoutScreen from "../screens/team/TeamWorkoutScreen";
import CreateTeamScreen from "../screens/team/CreateTeamScreen";
import JoinTeamScreen from "../screens/team/JoinTeamScreen";

const Stack = createNativeStackNavigator();

export default function TeamNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeamWorkout" component={TeamWorkoutScreen} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} />
      <Stack.Screen name="JoinTeam" component={JoinTeamScreen} />
    </Stack.Navigator>
  );
}