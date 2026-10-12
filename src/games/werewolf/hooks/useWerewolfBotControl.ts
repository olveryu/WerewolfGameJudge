/**
 * useWerewolfBotControl - Werewolf takeover ownership (AU-14).
 *
 * Owns the shared bot control, the takeover lifecycle guard, and the
 * effective identity derivation, so they live in one place like the
 * other six games' room-state hooks. Debug-scaffold actions
 * (fill / bulk marks) stay in useWerewolfDebugMode.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { useBotTakeoverGuard } from '@/features/room/controllers/useBotTakeoverGuard';
import { useRoomBotControl } from '@/features/room/controllers/useRoomBotControl';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

export interface WerewolfBotControlState {
  /** Which bot seat the Host is currently controlling (null = normal mode) */
  controlledSeat: number | null;
  takeOverBot: (seat: number) => void;
  releaseBot: () => void;
  /** Effective seat = controlledSeat ?? mySeat */
  effectiveSeat: number | null;
  /** Role of the effective seat */
  effectiveRole: RoleId | null;
}

export function useWerewolfBotControl(
  mySeat: number | null,
  gameState: LocalGameState,
  isHost: boolean,
): WerewolfBotControlState {
  const botControl = useRoomBotControl();
  const { controlledSeat } = botControl;

  // Takeover lifecycle guard (shared by all seven games): auto-release
  // when the host loses host status or the controlled seat stops being
  // a bot. Must stay an unconditional top-level hook call.
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots: isHost,
    seatStillBot: controlledSeat === null || gameState.players.get(controlledSeat)?.isBot === true,
    release: botControl.release,
  });

  // effectiveSeat = controlledSeat ?? mySeat
  const effectiveSeat = controlledSeat ?? mySeat;

  // effectiveRole = role of effectiveSeat
  const effectiveRole =
    effectiveSeat !== null ? (gameState.players.get(effectiveSeat)?.role ?? null) : null;

  return {
    controlledSeat,
    takeOverBot: botControl.takeOver,
    releaseBot: botControl.release,
    effectiveSeat,
    effectiveRole,
  };
}
