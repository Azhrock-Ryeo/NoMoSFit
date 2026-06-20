import React, { createContext, useContext } from 'react';
import { Database } from '@nozbe/watermelondb';
import { DatabaseProvider as WatermelonDBProvider } from '@nozbe/watermelondb/react';
import { database } from '../../lib/database';

const DatabaseContext = createContext<Database>(database);

export const useDatabaseContext = () => useContext(DatabaseContext);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <WatermelonDBProvider database={database}>
      {children}
    </WatermelonDBProvider>
  );
}