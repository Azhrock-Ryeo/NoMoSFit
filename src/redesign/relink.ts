/*
 * Recreating a routine you removed earlier should pick its History back up.
 *
 * History belongs to a routine's ID, not its name. A routine created from
 * scratch gets a new ID, so without this it would open with "no recorded
 * sessions" even though the old sessions are still saved under the old ID.
 *
 * When a NEW routine has the same name as a removed routine that still has
 * History, it reuses that routine's ID, and each exercise with a matching
 * name reuses its old exercise ID, so "last workout" comparisons continue.
 */
import type { ProgramExercise, WorkoutProgram } from '../types/program';
import type { WorkoutSession } from '../types/history';

const key = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

export function relinkToHistory(name: string, exercises: ProgramExercise[], sessions: WorkoutSession[], programs: WorkoutProgram[]) {
  const inUse = new Set(programs.map(program => program.id));
  const previous = [...sessions]
    .filter(session => key(session.programName) === key(name) && !inUse.has(session.programId))
    .sort((a, b) => b.finishedAt - a.finishedAt);
  if (!previous.length) return { programId: undefined as string | undefined, exercises, renamed: {} as Record<string, string> };
  const programId = previous[0].programId;
  // Newest session first, so the most recent ID for a name wins.
  const idByName = new Map<string, string>();
  for (const session of previous.filter(item => item.programId === programId)) {
    for (const set of session.completedSets) if (!idByName.has(key(set.exerciseName))) idByName.set(key(set.exerciseName), set.exerciseId);
  }
  const taken = new Set<string>();
  const renamed: Record<string, string> = {};
  const linked = exercises.map(exercise => {
    const old = idByName.get(key(exercise.name));
    if (!old || taken.has(old)) return exercise;
    taken.add(old); renamed[exercise.id] = old;
    return { ...exercise, id: old };
  });
  return { programId, exercises: linked, renamed };
}
