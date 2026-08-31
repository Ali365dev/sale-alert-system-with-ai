export const STAGGER_STEP_MS = 150;
export const MAX_STAGGER_INDEX = 10;

/** Delay (ms) for the entrance animation of a list item at this position —
 * capped so items far down a long list don't wait minutes to appear. */
export const staggerDelay = (index) => Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP_MS;
