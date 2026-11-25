/** Item centers land at (rep - MIN_REPS) * ITEM_WIDTH after symmetric side padding. */
export const MIN_REPS = 1;
export const MAX_REPS = 100;
export const REP_ITEM_WIDTH = 52;
export const REP_VALUES = Array.from({ length: MAX_REPS - MIN_REPS + 1 }, (_, i) => i + MIN_REPS);
export function safeRep(value: number): number {
  return Math.max(MIN_REPS, Math.min(MAX_REPS, Math.round(Number.isFinite(value) ? value : MIN_REPS)));
}
export function repFromOffset(offset: number): number {
  return safeRep(Math.round((Number.isFinite(offset) ? offset : 0) / REP_ITEM_WIDTH) + MIN_REPS);
}
export function offsetForRep(value: number): number { return (safeRep(value) - MIN_REPS) * REP_ITEM_WIDTH; }
export function pickerPadding(viewport: number): number { return Math.max(0, (viewport - REP_ITEM_WIDTH) / 2); }
