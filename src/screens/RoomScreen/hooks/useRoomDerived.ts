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
  effectiveRole: RoleId | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

const WOLF_HINT_KINDS = new Set(['wolf_unanimity_required', 'wolf_tie_random']);

function getWolfHintLine(
  hint: NonNullable<LocalGameState['ui']>['currentActorHint'],
  effectiveRole: RoleId | null,
): string | null {
  if (!hint || !effectiveRole) return null;
  if (!WOLF_HINT_KINDS.has(hint.kind)) return null;
  if (!hint.targetRoleIds.includes(effectiveRole)) return null;
  return `⚠️ ${hint.message}`;
}

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
    effectiveRole,
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
        currentSchema?.kind === 'groupConfirm'
          ? (() => {
              const acksMap: Record<string, readonly number[]> = {
                awakenedGargoyleConvertReveal: gameState.conversionRevealAcks,
                cupidLoversReveal: gameState.cupidLoversRevealAcks,
                piperHypnotizedReveal: gameState.piperRevealAcks,
              };
              const id = currentSchema.id;
              if (!(id in acksMap)) {
                throw new Error(`Unknown groupConfirm step: ${id}`);
              }
              return acksMap[id];
            })()
          : undefined,
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
    const hintLine = getWolfHintLine(gameState?.ui?.currentActorHint, effectiveRole);

    const parts = [baseMessage, wolfStatusLine, hintLine].filter(Boolean);
    return parts.join('\n');
  }, [gameState, currentActionRole, currentSchema, getWolfStatusLine, effectiveRole]);

  return {
    seatViewModels,
    ...roleStats,
    actionMessage,
  };
}
