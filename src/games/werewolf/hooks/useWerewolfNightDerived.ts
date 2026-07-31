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
  /** Authoritative stepId from Host ROLE_TURN */
  currentStepId: SchemaId | null;
  /** Whether audio is currently playing */
  isAudioPlaying: boolean;
}

/**
 * Derives night-phase values from game state.
 * All pure useMemo computations — no side effects, no subscriptions.
 */
export function useWerewolfNightDerived(gameState: LocalGameState): WerewolfNightDerivedValues {
  // Current action role + schemaId — derived from NightPlan in one pass.
  // Phase 5: actionOrder removed from template, now derived from NightPlan.
  // Uses currentStepIndex to pick the exact step, which correctly handles roles
  // with multiple night steps (e.g. piper → piperHypnotize + piperHypnotizedReveal).
  const { currentActionRole, currentSchemaId } = useMemo(() => {
    const NONE = { currentActionRole: null, currentSchemaId: null } as const;
    if (gameState.status !== GameStatus.Ongoing) return NONE;
    const nightPlan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
    if (gameState.currentStepIndex >= nightPlan.steps.length) return NONE;
    const step = nightPlan.steps[gameState.currentStepIndex]!;
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

  // Authoritative stepId from Host ROLE_TURN (UI-only)
  const currentStepId: SchemaId | null = gameState.currentStepId ?? null;

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
