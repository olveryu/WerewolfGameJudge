/**
 * actionIntentHelpers — Pure utility functions for action intent processing.
 *
 * Extracted from useActionOrchestrator to reduce complexity.
 * No hooks, no side effects, no closure captures.
 */

import type { WerewolfActionInput } from '@game-judge/game-engine/games/werewolf/public';
import type { RevealKind } from '@game-judge/game-engine/games/werewolf/public';
import type {
  ActionSchema,
  InlineSubStepSchema,
} from '@game-judge/game-engine/games/werewolf/public';

import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

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
  switch (kind) {
    case 'seer':
      return state.seerReveal;
    case 'psychic':
      return state.psychicReveal;
    case 'gargoyle':
      return state.gargoyleReveal;
    case 'wolfRobot':
      return state.wolfRobotReveal;
    case 'pureWhite':
      return state.pureWhiteReveal;
    case 'wolfWitch':
      return state.wolfWitchReveal;
    case 'mirrorSeer':
      return state.mirrorSeerReveal;
    case 'drunkSeer':
      return state.drunkSeerReveal;
    default: {
      const unsupportedKind: never = kind;
      throw new Error(`[FAIL-FAST] Unsupported reveal kind: ${unsupportedKind}`);
    }
  }
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
 * Build the canonical Witch action input.
 */
export function buildWitchActionInput(opts: {
  saveTarget: number | null;
  poisonTarget: number | null;
}): Extract<WerewolfActionInput, { kind: 'witch' }> {
  return {
    kind: 'witch',
    saveTarget: opts.saveTarget,
    poisonTarget: opts.poisonTarget,
  };
}
