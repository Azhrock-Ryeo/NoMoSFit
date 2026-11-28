/*
 * Exercise name suggestions for the routine editor.
 * Names you have already used come first, then this built-in list.
 * Suggestions only save typing: charts and History follow each
 * exercise's ID, not its spelling.
 */
export const COMMON_EXERCISES = [
  // Chest
  'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press',
  'Chest Fly', 'Cable Fly', 'Pec Deck', 'Push-Up', 'Dips',
  // Shoulders
  'Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Face Pull', 'Upright Row', 'Shrug',
  // Back
  'Deadlift', 'Barbell Row', 'Dumbbell Row', 'Seated Cable Row', 'T-Bar Row', 'Lat Pulldown', 'Pull-Up', 'Chin-Up', 'Straight-Arm Pulldown', 'Back Extension',
  // Arms
  'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl', 'Triceps Pushdown', 'Skull Crusher',
  'Overhead Triceps Extension', 'Close-Grip Bench Press', 'Wrist Curl',
  // Legs
  'Squat', 'Front Squat', 'Goblet Squat', 'Leg Press', 'Hack Squat', 'Lunge', 'Bulgarian Split Squat', 'Romanian Deadlift',
  'Leg Extension', 'Leg Curl', 'Hip Thrust', 'Glute Bridge', 'Calf Raise', 'Seated Calf Raise',
  // Core
  'Plank', 'Crunch', 'Cable Crunch', 'Hanging Leg Raise', 'Leg Raise', 'Russian Twist', 'Ab Wheel Rollout', 'Mountain Climber',
];

const key = (name: string) => name.trim().toLocaleLowerCase().replace(/[\s-]+/g, ' ');

/** Up to `limit` names matching what has been typed, never repeating the text itself. */
export function suggestExercises(text: string, yours: string[] = [], limit = 4): string[] {
  const typed = key(text);
  if (typed.length < 2) return [];
  const seen = new Set<string>();
  const all: string[] = [];
  for (const name of [...yours, ...COMMON_EXERCISES]) {
    const k = key(name);
    if (!k || seen.has(k)) continue;
    seen.add(k); if (name.trim() !== text.trim()) all.push(name.trim());
  }
  const starts = all.filter(name => key(name).startsWith(typed));
  const words = all.filter(name => !key(name).startsWith(typed) && key(name).split(' ').some(word => word.startsWith(typed)));
  const inside = all.filter(name => !starts.includes(name) && !words.includes(name) && key(name).includes(typed));
  return [...starts, ...words, ...inside].slice(0, limit);
}
