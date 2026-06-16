import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./AppNavigator";

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}