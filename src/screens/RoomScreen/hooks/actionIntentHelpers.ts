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
export interface WitchStepResultsExtra {
  stepResults: { save: number | null; poison: number | null };
}

// ─────────────────────────────────────────────────────────────────────────────
// RevealKind mapping tables (exhaustive via `satisfies Record<RevealKind, …>`)
// ─────────────────────────────────────────────────────────────────────────────

/** Maps RevealKind → GameState field name that holds the reveal data. */
const REVEAL_STATE_KEY = {
  seer: 'seerReveal',
  mirrorSeer: 'mirrorSeerReveal',
  drunkSeer: 'drunkSeerReveal',
  psychic: 'psychicReveal',
  gargoyle: 'gargoyleReveal',
  pureWhite: 'pureWhiteReveal',
  wolfWitch: 'wolfWitchReveal',
  wolfRobot: 'wolfRobotReveal',
} as const satisfies Record<RevealKind, string>;

/** Maps RevealKind → dialog title prefix shown to the player. */
const REVEAL_TITLE_PREFIX = {
  seer: '查验结果',
  mirrorSeer: '查验结果',
  drunkSeer: '查验结果',
  psychic: '通灵结果',
  gargoyle: '石像鬼探查',
  pureWhite: '纯白查验',
  wolfWitch: '狼巫查验',
  wolfRobot: '学习结果',
} as const satisfies Record<RevealKind, string>;

/**
 * RevealKinds whose result is a plain '好人'/'狼人' string (displayed as-is).
 * Others show getRoleDisplayName(result).
 */
const CHECK_RESULT_REVEAL_KINDS: ReadonlySet<RevealKind> = new Set([
  'seer',
  'mirrorSeer',
  'drunkSeer',
]);

/** Read reveal data from GameState for a given RevealKind. */
export function getRevealDataFromState(
  state: LocalGameState,
  kind: RevealKind,
): { targetSeat: number; result: string } | undefined {
  const key = REVEAL_STATE_KEY[kind];
  // LocalGameState has no index signature — cast via unknown to access by dynamic key.
  // Safety: REVEAL_STATE_KEY values are compile-time verified via `satisfies Record<RevealKind, …>`.
  return (state as unknown as Record<string, unknown>)[key] as
    | { targetSeat: number; result: string }
    | undefined;
}

/** Get the dialog title prefix for a reveal kind. */
export function getRevealTitlePrefix(kind: RevealKind): string {
  return REVEAL_TITLE_PREFIX[kind];
}

/** Whether the reveal result should be displayed as-is (true) or via getRoleDisplayName (false). */
export function isCheckResultReveal(kind: RevealKind): boolean {
  return CHECK_RESULT_REVEAL_KINDS.has(kind);
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
  return (currentSchema?.kind === 'chooseSeat' && currentSchema.ui?.confirmTitle) || '确认行动';
}

/**
 * Get the confirm dialog body text for a seat action.
 * Returns the schema-specific text for chooseSeat, or a generic fallback.
 */
export function getConfirmTextForSeatAction(
  currentSchema: ActionSchema | null,
  targetSeat: number,
): string {
  return (
    (currentSchema?.kind === 'chooseSeat' && currentSchema.ui?.confirmText) ||
    `是否对${targetSeat + 1}号玩家使用技能？`
  );
}
