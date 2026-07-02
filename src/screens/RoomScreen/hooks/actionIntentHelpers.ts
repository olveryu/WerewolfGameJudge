/**
 * actionIntentHelpers — Pure utility functions for action intent processing.
 *
 * Extracted from useActionOrchestrator to reduce complexity.
 * No hooks, no side effects, no closure captures.
 */

import type { RevealKind } from '@werewolf/game-engine/werewolf/models/roles';
import type {
  ActionSchema,
  InlineSubStepSchema,
} from '@werewolf/game-engine/werewolf/models/roles/spec';

import type { LocalWerewolfState } from '@/hooks/adapters/werewolfStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Wire payload shape for witch step results (save / poison targets). */
interface WitchStepResultsExtra {
  stepResults: { save: number | null; poison: number | null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reveal: WerewolfState field access
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read reveal data from WerewolfState for a given RevealKind.
 *
 * WerewolfState field naming convention: `${kind}Reveal` (e.g. seerReveal, psychicReveal).
 */
export function getRevealDataFromState(
  state: LocalWerewolfState,
  kind: RevealKind,
): { targetSeat: number; result: string } | undefined {
  const key = `${kind}Reveal`;
  // LocalWerewolfState has no index signature — cast via unknown to access by dynamic key.
  return (state as unknown as Record<string, unknown>)[key] as
    | { targetSeat: number; result: string }
    | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a compound sub-step by key (e.g., 'save', 'poison' for witchAction).
 * Returns null if the schema is not compound or stepKey is falsy.
 */
export function getSubStepByKey(
  currentSchema: ActionSchema | null,
  stepKey: string | undefined,
): InlineSubStepSchema | null {
  if (!stepKey || currentSchema?.kind !== 'compound') return null;
  return currentSchema.steps.find((s) => s.key === stepKey) ?? null;
}

/**
 * Build witch action extra with stepResults protocol.
 */
export function buildWitchStepResults(opts: {
  saveTarget: number | null;
  poisonTarget: number | null;
}): WitchStepResultsExtra {
  return { stepResults: { save: opts.saveTarget, poison: opts.poisonTarget } };
}
