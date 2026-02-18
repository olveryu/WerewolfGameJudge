/**
 * useNightDerived - Pure derived values from game state for night phase UI
 *
 * Extracts all useMemo derivations related to night flow, schema, and audio state
 * from useGameRoom. These are pure computations with no side effects.
 * 从 gameState 派生 schema/step/audio 相关值（useMemo）。
 * 不包含副作用，不修改状态，不调用 service。
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { buildNightPlan, type RoleId } from '@werewolf/game-engine/models/roles';
import {
  type ActionSchema,
  getRoleSpec,
  getSchema,
  getStepsByRoleStrict,
  isValidRoleId,
  type SchemaId,
} from '@werewolf/game-engine/models/roles/spec';
import type {
  ResolvedRoleRevealAnimation,
  RoleRevealAnimation,
} from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useMemo } from 'react';

import type { LocalGameState } from '@/types/GameStateTypes';

interface NightDerivedValues {
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
  /** Role reveal animation setting */
  roleRevealAnimation: RoleRevealAnimation;
  /** Resolved animation for UI rendering (never 'random') */
  resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation;
}

/**
 * Derives night-phase values from game state.
 * All pure useMemo computations — no side effects, no subscriptions.
 */
export function useNightDerived(gameState: LocalGameState | null): NightDerivedValues {
  // Current action role - only valid when game is ongoing (night phase)
  // Phase 5: actionOrder removed from template, now derived from NightPlan
  const currentActionRole = useMemo((): RoleId | null => {
    if (!gameState) return null;
    // Only return action role when game is in progress
    if (gameState.status !== GameStatus.ongoing) return null;
    // Derive action order dynamically from template.roles via NightPlan
    const nightPlan = buildNightPlan(gameState.template.roles);
    if (gameState.currentStepIndex >= nightPlan.steps.length) return null;
    return nightPlan.steps[gameState.currentStepIndex].roleId;
  }, [gameState]);

  // Schema-driven UI (Phase 3): derive schemaId from currentActionRole locally
  // No broadcast needed - schema is derived from local spec
  const currentSchemaId = useMemo((): SchemaId | null => {
    if (!currentActionRole) return null;
    if (!isValidRoleId(currentActionRole)) return null;
    const spec = getRoleSpec(currentActionRole);
    if (!spec.night1.hasAction) return null;
    // M3: schemaId is derived from NIGHT_STEPS single source of truth.
    // Current assumption (locked by contract tests): each role has at most one NightStep.
    const [step] = getStepsByRoleStrict(currentActionRole);
    return step?.id ?? null; // step.id is the schemaId
  }, [currentActionRole]);

  // Schema-driven UI (Phase 3): derive full schema from schemaId
  const currentSchema = useMemo((): ActionSchema | null => {
    if (!currentSchemaId) return null;
    return getSchema(currentSchemaId);
  }, [currentSchemaId]);

  // Authoritative stepId from Host ROLE_TURN (UI-only)
  const currentStepId: SchemaId | null = gameState?.currentStepId ?? null;

  // Check if audio is currently playing
  const isAudioPlaying: boolean = gameState?.isAudioPlaying ?? false;

  // Role reveal animation (Host controlled, all players use)
  const roleRevealAnimation: RoleRevealAnimation = gameState?.roleRevealAnimation ?? 'random';

  // Resolved animation (for UI rendering - never 'random')
  // 'random' fallback 时返回 'roulette'（实际上 Host 会解析 random）
  const resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation =
    gameState?.resolvedRoleRevealAnimation ?? 'roulette';

  return {
    currentActionRole,
    currentSchemaId,
    currentSchema,
    currentStepId,
    isAudioPlaying,
    roleRevealAnimation,
    resolvedRoleRevealAnimation,
  };
}
