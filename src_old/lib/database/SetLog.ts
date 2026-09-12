import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class SetLog extends Model {
  static table = 'set_logs';

  @field('session_id') sessionId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('exercise_name') exerciseName!: string;
  @field('set_number') setNumber!: number;
  @field('target_reps') targetReps!: number;
  @field('achieved_reps') achievedReps!: number;
  @field('weight') weight!: number;
  @field('completed_at') completedAt!: number;
  @field('sync_status') syncStatus!: string;
}