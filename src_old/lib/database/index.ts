import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema';
import WorkoutSession from './WorkoutSession';
import SetLog from './SetLog';
import WorkoutTemplate from './WorkoutTemplate';

const adapter = new SQLiteAdapter({
  schema: mySchema,
  dbName: 'nomosfit',
  jsi: true,
  migrationEvents: true,
});

export const database = new Database({
  adapter,
  modelClasses: [WorkoutSession, SetLog, WorkoutTemplate],
});