import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'workout_sessions',
      columns: [
        { name: 'workout_id', type: 'string' },
        { name: 'workout_name', type: 'string' },
        { name: 'started_at', type: 'number' },
        { name: 'ended_at', type: 'number', isOptional: true },
        { name: 'duration_seconds', type: 'number', isOptional: true },
        { name: 'was_completed', type: 'boolean' },
        { name: 'sync_status', type: 'string' },
        { name: 'firebase_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'set_logs',
      columns: [
        { name: 'session_id', type: 'string' },
        { name: 'exercise_id', type: 'string' },
        { name: 'exercise_name', type: 'string' },
        { name: 'set_number', type: 'number' },
        { name: 'target_reps', type: 'number' },
        { name: 'achieved_reps', type: 'number' },
        { name: 'weight', type: 'number' },
        { name: 'completed_at', type: 'number' },
        { name: 'sync_status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'workout_templates',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'sync_status', type: 'string' },
        { name: 'firebase_id', type: 'string', isOptional: true },
      ],
    }),
  ],
});