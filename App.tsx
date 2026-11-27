import React from 'react';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/providers/AuthProvider';
import { CloudSyncProvider } from './src/providers/CloudSyncProvider';
import RootNavigator from './src/redesign/Navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CloudSyncProvider />
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
