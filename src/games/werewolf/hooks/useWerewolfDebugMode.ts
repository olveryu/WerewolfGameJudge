/**
 * useWerewolfDebugMode - Debug mode state for Host bot control
 *
 * Manages:
 * - Controlled seat (Host takes over a bot seat)
 * - effectiveSeat / effectiveRole derivation
 * - isDebugMode flag
 * - fillWithBots / markAllBotsViewed actions
 *
 * Derives effectiveSeat/effectiveRole and calls client debug API.
 * Does not directly modify GameState or bypass client game operations.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback } from 'react';

import { useRoomBotControl } from '@/features/room/controllers/useRoomBotControl';
import type {
  WerewolfCommandDispatchOutcome,
  WerewolfGameClient,
} from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

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
  fillWithBots: () => Promise<WerewolfCommandDispatchOutcome>;
  /** Mark all bot seats as having viewed their roles */
  markAllBotsViewed: () => Promise<WerewolfCommandDispatchOutcome>;
  /** Mark all bot seats as having acked groupConfirm step */
  markAllBotsGroupConfirmed: () => Promise<WerewolfCommandDispatchOutcome>;
}

/**
 * Debug mode hook for Host bot control.
 * When Host controls a bot seat, effectiveSeat/effectiveRole reflect the bot's identity.
 */
export function useWerewolfDebugMode(
  client: WerewolfGameClient,
  mySeat: number | null,
  gameState: LocalGameState,
  fillBots: () => Promise<WerewolfCommandDispatchOutcome>,
): WerewolfDebugModeState {
  const botControl = useRoomBotControl();
  const { controlledSeat } = botControl;

  // effectiveSeat = controlledSeat ?? mySeat
  const effectiveSeat = controlledSeat ?? mySeat;

  // effectiveRole = role of effectiveSeat
  const effectiveRole =
    effectiveSeat !== null ? (gameState.players.get(effectiveSeat)?.role ?? null) : null;

  // Whether debug bot mode is active
  const isDebugMode = gameState.debugMode?.botsEnabled === true;

  // Fill all empty seats with bots
  const fillWithBots = useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
    return fillBots();
  }, [fillBots]);

  // Mark all bot seats as having viewed their roles
  const markAllBotsViewed = useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
    return client.markAllBotsViewed();
  }, [client]);

  // Mark all bot seats as having acked groupConfirm step
  const markAllBotsGroupConfirmed =
    useCallback(async (): Promise<WerewolfCommandDispatchOutcome> => {
      return client.markAllBotsGroupConfirmed();
    }, [client]);

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
