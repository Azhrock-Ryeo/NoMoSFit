import groq from '../config/groq';

export interface WorkoutAnalysisInput {
  workoutName: string;
  durationSeconds: number;
  exercises: {
    exerciseName: string;
    sets: {
      setNumber: number;
      achievedReps: number;
      weight: number;
    }[];
  }[];
}

export async function analyzeWorkout(input: WorkoutAnalysisInput): Promise<string> {
  const workoutSummary = input.exercises.map(e => {
    const setsSummary = e.sets.map(s =>
      `Set ${s.setNumber}: ${s.achievedReps} reps @ ${s.weight}kg`
    ).join(', ');
    return `${e.exerciseName}: ${setsSummary}`;
  }).join('\n');

  const prompt = `You are a professional fitness coach. Analyze this workout and give brief, motivating feedback with recovery tips and next session goals.

Workout: ${input.workoutName}
Duration: ${Math.floor(input.durationSeconds / 60)} minutes

Exercises:
${workoutSummary}

Give a 3-4 sentence response covering: performance feedback, recovery suggestion, and next workout goal.`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || 'Great workout! Keep it up!';
}