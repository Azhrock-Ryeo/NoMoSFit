import React from 'react';
import { AuthProvider } from './src/app/providers/AuthProvider';
import { QueryProvider } from './src/app/providers/QueryProvider';
import { DatabaseProvider } from './src/app/providers/DatabaseProvider';
import { SyncProvider } from './src/app/providers/SyncProvider';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <DatabaseProvider>
      <QueryProvider>
        <AuthProvider>
          <SyncProvider>
            <RootNavigator />
          </SyncProvider>
        </AuthProvider>
      </QueryProvider>
    </DatabaseProvider>
  );
}