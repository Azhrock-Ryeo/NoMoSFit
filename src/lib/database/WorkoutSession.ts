import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class WorkoutSession extends Model {
  static table = 'workout_sessions';

  @field('workout_id') workoutId!: string;
  @field('workout_name') workoutName!: string;
  @field('started_at') startedAt!: number;
  @field('ended_at') endedAt!: number;
  @field('duration_seconds') durationSeconds!: number;
  @field('was_completed') wasCompleted!: boolean;
  @field('sync_status') syncStatus!: string;
  @field('firebase_id') firebaseId!: string;
}