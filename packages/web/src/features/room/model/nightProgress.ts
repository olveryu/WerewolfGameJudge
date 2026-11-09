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
