/**
 * useRoomDerived — Derived view-model computations for RoomScreen.
 *
 * Computes seatViewModels, roleStats, currentSchemaConstraints, and actionMessage
 * from game state and hook outputs. Pure derivation via useMemo — no state,
 * no side-effects, no service calls.
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';
import { useMemo } from 'react';

import type { LocalGameState } from '@/types/GameStateTypes';

import { buildSeatViewModels, getRoleStats } from '../RoomScreen.helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseRoomDerivedInput {
  gameState: LocalGameState | null;
  currentSchema: ActionSchema | null;
  currentActionRole: RoleId | null;
  roomStatus: GameStatus;
  actorSeatForUi: number | null;
  showWolves: boolean;
  imActioner: boolean;
  firstSwapSeat: number | null;
  secondSeat: number | null;
  multiSelectedSeats: readonly number[];
  getWolfStatusLine: () => string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomDerived(input: UseRoomDerivedInput) {
  const {
    gameState,
    currentSchema,
    currentActionRole,
    roomStatus,
    actorSeatForUi,
    showWolves,
    imActioner,
    firstSwapSeat,
    secondSeat,
    multiSelectedSeats,
    getWolfStatusLine,
  } = input;

  // ── Schema constraints (consumed by seatViewModels) ──────────────────────

  const currentSchemaConstraints = useMemo(() => {
    if (!currentSchema) return undefined;
    if (
      currentSchema.kind === 'chooseSeat' ||
      currentSchema.kind === 'swap' ||
      currentSchema.kind === 'multiChooseSeat'
    ) {
      return currentSchema.constraints;
    }
    return undefined;
  }, [currentSchema]);

  // ── Seat view models ─────────────────────────────────────────────────────

  const seatViewModels = useMemo(() => {
    if (!gameState) return [];

    const skipConstraints =
      currentSchema?.id === 'wolfRobotLearn' && gameState.wolfRobotReveal != null;

    return buildSeatViewModels(gameState, actorSeatForUi, showWolves, firstSwapSeat, {
      schemaConstraints: imActioner && !skipConstraints ? currentSchemaConstraints : undefined,
      secondSelectedSeat: secondSeat,
      multiSelectedSeats,
      showReadyBadges: roomStatus === GameStatus.Assigned || roomStatus === GameStatus.Ready,
      groupConfirmAcks:
        currentSchema?.kind === 'groupConfirm' ? (gameState.piperRevealAcks ?? []) : undefined,
    });
  }, [
    gameState,
    actorSeatForUi,
    showWolves,
    firstSwapSeat,
    secondSeat,
    multiSelectedSeats,
    imActioner,
    currentSchemaConstraints,
    currentSchema?.id,
    currentSchema?.kind,
    roomStatus,
  ]);

  // ── Role stats ───────────────────────────────────────────────────────────

  const roleStats = useMemo(() => {
    if (!gameState) {
      return {
        roleCounts: {} as Record<string, number>,
        wolfRoles: [] as string[],
        godRoles: [] as string[],
        specialRoles: [] as string[],
        villagerCount: 0,
        wolfRoleItems: [] as ReturnType<typeof getRoleStats>['wolfRoleItems'],
        godRoleItems: [] as ReturnType<typeof getRoleStats>['godRoleItems'],
        specialRoleItems: [] as ReturnType<typeof getRoleStats>['specialRoleItems'],
        villagerRoleItems: [] as ReturnType<typeof getRoleStats>['villagerRoleItems'],
      };
    }
    return getRoleStats(gameState.template.roles);
  }, [gameState]);

  // ── Action message ───────────────────────────────────────────────────────

  const actionMessage = useMemo(() => {
    if (!currentActionRole) return '';
    if (!currentSchema?.ui?.prompt) {
      throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
    }

    const isWolfRobotHunterGateActive =
      currentSchema.id === 'wolfRobotLearn' &&
      gameState?.wolfRobotReveal?.learnedRoleId === 'hunter' &&
      !gameState?.wolfRobotHunterStatusViewed;

    const baseMessage = isWolfRobotHunterGateActive
      ? (currentSchema.ui.hunterGatePrompt ?? currentSchema.ui.prompt)
      : currentSchema.ui.prompt;

    const wolfStatusLine = getWolfStatusLine();
    if (wolfStatusLine) {
      return `${baseMessage}\n${wolfStatusLine}`;
    }

    return baseMessage;
  }, [gameState, currentActionRole, currentSchema, getWolfStatusLine]);

  return {
    seatViewModels,
    ...roleStats,
    actionMessage,
  };
}
