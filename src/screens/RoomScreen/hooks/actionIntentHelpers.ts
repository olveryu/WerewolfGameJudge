/**
 * actionIntentHelpers — Pure utility functions for action intent processing.
 *
 * Extracted from useActionOrchestrator to reduce complexity.
 * No hooks, no side effects, no closure captures.
 */

import type { ActionSchema, InlineSubStepSchema } from '@werewolf/game-engine/models/roles/spec';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Wire payload shape for witch step results (save / poison targets). */
interface WitchStepResultsExtra {
  stepResults: { save: number | null; poison: number | null };
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

/**
 * Get the confirm dialog title for the current schema.
 * Returns the schema-specific title for chooseSeat, or a generic fallback.
 */
export function getConfirmTitleForSchema(currentSchema: ActionSchema | null): string {
  return currentSchema?.kind === 'chooseSeat' ? currentSchema.ui!.confirmTitle! : '确认行动';
}

/**
 * Get the confirm dialog body text for a seat action.
 * Returns the schema-specific text for chooseSeat, or a generic fallback.
 */
export function getConfirmTextForSeatAction(
  currentSchema: ActionSchema | null,
  targetSeat: number,
): string {
  return currentSchema?.kind === 'chooseSeat'
    ? currentSchema.ui!.confirmText!
    : `是否对${targetSeat + 1}号玩家使用技能？`;
}
