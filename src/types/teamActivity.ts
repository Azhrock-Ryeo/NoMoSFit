export interface TeamWorkoutActivity {
  id: string;

  teamId: string;

  userId: string;
  displayName: string;

  sessionId: string;

  programId: string;
  programName: string;

  finishedAt: number;
  durationSeconds: number;

  totalSets: number;
  totalReps: number;
  totalVolume: number;
}