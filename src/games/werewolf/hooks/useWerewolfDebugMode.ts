/**
 * useWerewolfDebugMode - Host bot-test scaffold (AU-14).
 *
 * Only the bulk bot actions live here (fill, mark viewed, mark
 * group-confirmed). Takeover state is owned by
 * useWerewolfBotControl. The scaffold gates key off bot existence
 * (AU-17); the old debugMode state flag is deleted.
 */

import { useCallback } from 'react';

import type {
  WerewolfCommandDispatchOutcome,
  WerewolfGameClient,
} from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

export interface WerewolfDebugModeState {
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
    fillWithBots,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
  };
}
