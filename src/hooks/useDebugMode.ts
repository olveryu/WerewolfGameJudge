/**
 * useDebugMode - Debug mode state for Host bot control
 *
 * Manages:
 * - Controlled seat (Host takes over a bot seat)
 * - effectiveSeat / effectiveRole derivation
 * - isDebugMode flag
 * - fillWithBots / markAllBotsViewed actions
 *
 * ✅ 允许：派生 effectiveSeat/effectiveRole、调用 facade debug API
 * ❌ 禁止：直接修改 BroadcastGameState、跳过 facade 操作游戏
 */

import { useState, useMemo, useCallback } from 'react';
import type { LocalGameState } from '@/services/types/GameStateTypes';
import type { RoleId } from '@/models/roles';
import type { IGameFacade } from '@/services/types/IGameFacade';

export interface DebugModeState {
  /** Which bot seat the Host is currently controlling (null = normal mode) */
  controlledSeat: number | null;
  setControlledSeat: (seat: number | null) => void;
  /** Effective seat = controlledSeat ?? mySeatNumber */
  effectiveSeat: number | null;
  /** Role of the effective seat */
  effectiveRole: RoleId | null;
  /** Whether debug bot mode is active */
  isDebugMode: boolean;
  /** Fill all empty seats with bots */
  fillWithBots: () => Promise<{ success: boolean; reason?: string }>;
  /** Mark all bot seats as having viewed their roles */
  markAllBotsViewed: () => Promise<{ success: boolean; reason?: string }>;
}

/**
 * Debug mode hook for Host bot control.
 * When Host controls a bot seat, effectiveSeat/effectiveRole reflect the bot's identity.
 */
export function useDebugMode(
  facade: IGameFacade,
  isHost: boolean,
  mySeatNumber: number | null,
  gameState: LocalGameState | null,
): DebugModeState {
  const [controlledSeat, setControlledSeat] = useState<number | null>(null);

  // effectiveSeat = controlledSeat ?? mySeatNumber
  const effectiveSeat = useMemo(() => {
    return controlledSeat ?? mySeatNumber;
  }, [controlledSeat, mySeatNumber]);

  // effectiveRole = role of effectiveSeat
  const effectiveRole = useMemo(() => {
    if (effectiveSeat === null || !gameState) return null;
    return gameState.players.get(effectiveSeat)?.role ?? null;
  }, [gameState, effectiveSeat]);

  // Whether debug bot mode is active
  const isDebugMode = useMemo(() => {
    return gameState?.debugMode?.botsEnabled === true;
  }, [gameState]);

  // Fill all empty seats with bots
  const fillWithBots = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    if (!isHost) {
      return { success: false, reason: 'host_only' };
    }
    // If Host is seated, leave seat first so the seat can be filled with a bot
    if (mySeatNumber !== null) {
      try {
        await facade.leaveSeat();
      } catch (err) {
        return { success: false, reason: `failed_to_leave_seat: ${String(err)}` };
      }
    }
    return facade.fillWithBots();
  }, [isHost, mySeatNumber, facade]);

  // Mark all bot seats as having viewed their roles
  const markAllBotsViewed = useCallback(async (): Promise<{
    success: boolean;
    reason?: string;
  }> => {
    if (!isHost) {
      return { success: false, reason: 'host_only' };
    }
    return facade.markAllBotsViewed();
  }, [isHost, facade]);

  return {
    controlledSeat,
    setControlledSeat,
    effectiveSeat,
    effectiveRole,
    isDebugMode,
    fillWithBots,
    markAllBotsViewed,
  };
}
