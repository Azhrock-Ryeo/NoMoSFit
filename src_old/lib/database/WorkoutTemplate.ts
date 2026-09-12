import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class WorkoutTemplate extends Model {
  static table = 'workout_templates';

  @field('name') name!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('sync_status') syncStatus!: string;
  @field('firebase_id') firebaseId!: string;
}