/**
 * useWerewolfNightDerived - Pure derived values from game state for night phase UI
 *
 * Extracts all useMemo derivations related to night flow, schema, and audio state
 * from useWerewolfRoom. These are pure computations with no side effects.
 * Derives schema/step/audio-related values from gameState (useMemo).
 * No side effects, no state mutation, no service calls.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { buildNightPlan, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  type ActionSchema,
  getSchema,
  type SchemaId,
} from '@game-judge/game-engine/games/werewolf/public';
import { useMemo } from 'react';

import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

interface WerewolfNightDerivedValues {
  /** Current action role derived from NightPlan */
  currentActionRole: RoleId | null;
  /** SchemaId for current action role (null if no action) */
  currentSchemaId: SchemaId | null;
  /** Full schema derived from schemaId */
  currentSchema: ActionSchema | null;
  /** Authoritative stepId from the engine's nightStep (UI-only) */
  currentStepId: SchemaId | null;
  /** Whether audio is currently playing */
  isAudioPlaying: boolean;
}

/**
 * Derives night-phase values from game state.
 * All pure useMemo computations — no side effects, no subscriptions.
 */
export function useWerewolfNightDerived(gameState: LocalGameState): WerewolfNightDerivedValues {
  // Current action role + schemaId — resolved from the single stored step
  // identity (nightStep.stepId) through the NightPlan. Roles with multiple
  // night steps (e.g. piper → piperHypnotize + piperHypnotizedReveal) are
  // handled exactly, since the plan lookup is by step id, not position.
  const { currentActionRole, currentSchemaId } = useMemo(() => {
    const NONE = { currentActionRole: null, currentSchemaId: null } as const;
    if (gameState.status !== GameStatus.Ongoing) return NONE;
    const nightStep = gameState.nightStep;
    if (nightStep?.kind !== 'inStep') return NONE;
    const nightPlan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
    const step = nightPlan.steps.find((s) => s.stepId === nightStep.stepId);
    if (!step) return NONE;
    return {
      currentActionRole: step.roleId,
      currentSchemaId: step.stepId,
    };
  }, [gameState]);

  // Schema-driven UI (Phase 3): derive full schema from schemaId
  const currentSchema = useMemo((): ActionSchema | null => {
    if (!currentSchemaId) return null;
    return getSchema(currentSchemaId);
  }, [currentSchemaId]);

  // Authoritative stepId: the same nightStep identity the derivation above
  // consumed — one source for role, schema, and step id.
  const currentStepId: SchemaId | null =
    gameState.nightStep?.kind === 'inStep' ? gameState.nightStep.stepId : null;

  // Check if audio is currently playing
  const isAudioPlaying = gameState.isAudioPlaying;

  return {
    currentActionRole,
    currentSchemaId,
    currentSchema,
    currentStepId,
    isAudioPlaying,
  };
}
