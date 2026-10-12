/**
 * useWerewolfDebugMode - Host bot-test scaffold (AU-14).
 *
 * Only the debugMode flag and the bulk bot actions live here.
 * Takeover state (controlled seat, guard, effective identity) is
 * owned by useWerewolfBotControl; this hook never carried product
 * behavior - debugMode is the host's manual testing scaffold.
 */

import { useCallback } from 'react';

import type {
  WerewolfCommandDispatchOutcome,
  WerewolfGameClient,
} from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

export interface WerewolfDebugModeState {
  /** Whether debug bot mode is active */
  isDebugMode: boolean;
  /** Fill all empty seats with bots */
  fillWithBots: () => Promise<WerewolfCommandDispatchOutcome>;
  /** Mark all bot seats as having viewed their roles */
  markAllBotsViewed: () => Promise<WerewolfCommandDispatchOutcome>;
  /** Mark all bot seats as having acked groupConfirm step */
  markAllBotsGroupConfirmed: () => Promise<WerewolfCommandDispatchOutcome>;
}

export function useWerewolfDebugMode(
  client: WerewolfGameClient,
  gameState: LocalGameState,
  fillBots: () => Promise<WerewolfCommandDispatchOutcome>,
): WerewolfDebugModeState {
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
    isDebugMode,
    fillWithBots,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
  };
}
