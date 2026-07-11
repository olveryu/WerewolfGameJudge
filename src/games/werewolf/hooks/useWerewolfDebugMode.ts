/**
 * useWerewolfDebugMode - Debug mode state for Host bot control
 *
 * Manages:
 * - Controlled seat (Host takes over a bot seat)
 * - effectiveSeat / effectiveRole derivation
 * - isDebugMode flag
 * - fillWithBots / markAllBotsViewed actions
 *
 * Derives effectiveSeat/effectiveRole and calls facade debug API.
 * Does not directly modify GameState or bypass facade game operations.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { useCallback } from 'react';

import { useRoomBotControl } from '@/features/room/controllers/useRoomBotControl';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { LocalGameState } from '@/types/GameStateTypes';

export interface WerewolfDebugModeState {
  /** Which bot seat the Host is currently controlling (null = normal mode) */
  controlledSeat: number | null;
  takeOverBot: (seat: number) => void;
  releaseBot: () => void;
  /** Effective seat = controlledSeat ?? mySeat */
  effectiveSeat: number | null;
  /** Role of the effective seat */
  effectiveRole: RoleId | null;
  /** Whether debug bot mode is active */
  isDebugMode: boolean;
  /** Fill all empty seats with bots */
  fillWithBots: () => Promise<ActionResult>;
  /** Mark all bot seats as having viewed their roles */
  markAllBotsViewed: () => Promise<ActionResult>;
  /** Mark all bot seats as having acked groupConfirm step */
  markAllBotsGroupConfirmed: () => Promise<ActionResult>;
}

/**
 * Debug mode hook for Host bot control.
 * When Host controls a bot seat, effectiveSeat/effectiveRole reflect the bot's identity.
 */
export function useWerewolfDebugMode(
  facade: IGameFacade,
  mySeat: number | null,
  gameState: LocalGameState | null,
): WerewolfDebugModeState {
  const botControl = useRoomBotControl();
  const { controlledSeat } = botControl;

  // effectiveSeat = controlledSeat ?? mySeat
  const effectiveSeat = controlledSeat ?? mySeat;

  // effectiveRole = role of effectiveSeat
  const effectiveRole =
    effectiveSeat !== null && gameState
      ? (gameState.players.get(effectiveSeat)?.role ?? null)
      : null;

  // Whether debug bot mode is active
  const isDebugMode = gameState?.debugMode?.botsEnabled === true;

  // Fill all empty seats with bots
  const fillWithBots = useCallback(async (): Promise<ActionResult> => {
    if (!facade.isHostPlayer()) {
      return { success: false, reason: 'host_only' };
    }
    // If Host is seated, leave seat first so the seat can be filled with a bot
    if (facade.getMySeat() !== null) {
      const leaveResult = await facade.leaveSeat();
      if (!leaveResult.success) return leaveResult;
    }
    return facade.fillWithBots();
  }, [facade]);

  // Mark all bot seats as having viewed their roles
  const markAllBotsViewed = useCallback(async (): Promise<ActionResult> => {
    if (!facade.isHostPlayer()) {
      return { success: false, reason: 'host_only' };
    }
    return facade.markAllBotsViewed();
  }, [facade]);

  // Mark all bot seats as having acked groupConfirm step
  const markAllBotsGroupConfirmed = useCallback(async (): Promise<ActionResult> => {
    if (!facade.isHostPlayer()) {
      return { success: false, reason: 'host_only' };
    }
    return facade.markAllBotsGroupConfirmed();
  }, [facade]);

  return {
    controlledSeat,
    takeOverBot: botControl.takeOver,
    releaseBot: botControl.release,
    effectiveSeat,
    effectiveRole,
    isDebugMode,
    fillWithBots,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
  };
}
