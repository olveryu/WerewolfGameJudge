/**
 * actionIntentHelpers — Pure utility functions for action intent processing.
 *
 * Extracted from useActionOrchestrator to reduce complexity.
 * No hooks, no side effects, no closure captures.
 */

import type { RevealKind } from '@werewolf/game-engine/models/roles';
import type { ActionSchema, InlineSubStepSchema } from '@werewolf/game-engine/models/roles/spec';

import type { LocalGameState } from '@/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Wire payload shape for witch step results (save / poison targets). */
interface WitchStepResultsExtra {
  stepResults: { save: number | null; poison: number | null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reveal: GameState field access
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read reveal data from GameState for a given RevealKind.
 *
 * GameState field naming convention: `${kind}Reveal` (e.g. seerReveal, psychicReveal).
 */
export function getRevealDataFromState(
  state: LocalGameState,
  kind: RevealKind,
): { targetSeat: number; result: string } | undefined {
  const key = `${kind}Reveal`;
  // LocalGameState has no index signature — cast via unknown to access by dynamic key.
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
