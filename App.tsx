import React from 'react';
import { AuthProvider } from './src/app/providers/AuthProvider';
import { QueryProvider } from './src/app/providers/QueryProvider';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryProvider>
  );
}