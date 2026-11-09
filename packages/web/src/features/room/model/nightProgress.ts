/**
 * Night step progress — the single derivation behind the night
 * progress ribbon ("第x步 / 共y步" + current step label + progress
 * bar). Every nightPhase game feeds its own engine step list and
 * label table into this function; the step math lives here only, so
 * the night games cannot drift apart in how progress reads.
 */

export interface NightStepProgress {
  /** 1-based index of the current step. */
  readonly current: number;
  /** Total number of steps in the night. */
  readonly total: number;
  /** Display label of the current step. */
  readonly label: string;
}

/**
 * Resolves the progress for `currentStepId` within `steps`, or null
 * when the step has no progress representation (unknown step or no
 * label), letting callers fall back to a plain message ribbon.
 */
export function resolveStepProgress<TStep extends string>(
  steps: readonly TStep[],
  currentStepId: TStep,
  labels: Readonly<Partial<Record<TStep, string>>>,
): NightStepProgress | null {
  const index = steps.indexOf(currentStepId);
  if (index < 0) return null;
  const label = labels[currentStepId];
  if (label === undefined) return null;
  return { current: index + 1, total: steps.length, label };
}
