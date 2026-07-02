/**
 * roomLifecycle — shared room lifecycle capabilities for room-like games.
 *
 * Game adapters map their domain phase into GameStatus values before UI code asks
 * for capabilities. This keeps screens from branching on per-game phase names.
 */

import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';

export interface RoomLifecycleCapabilities {
  canSeat: boolean;
  canManageSeats: boolean;
  canViewSeatProfile: boolean;
  canTakeOverBots: boolean;
  canShowBotRoles: boolean;
  shouldConfirmExit: boolean;
}

interface GetRoomLifecycleCapabilitiesParams {
  status: GameStatus;
  isHost: boolean;
  hasBots?: boolean;
  isBotControlEnabled?: boolean;
}

export function isRoomSeatingStatus(status: GameStatus): boolean {
  return status === GameStatus.Unseated || status === GameStatus.Seated;
}

export function getRoomLifecycleCapabilities({
  status,
  isHost,
  hasBots = false,
  isBotControlEnabled = false,
}: GetRoomLifecycleCapabilitiesParams): RoomLifecycleCapabilities {
  const canSeat = isRoomSeatingStatus(status);
  const canTakeOverBots = isHost && hasBots && isBotControlEnabled;

  return {
    canSeat,
    canManageSeats: isHost && canSeat,
    canViewSeatProfile: status !== GameStatus.Ongoing,
    canTakeOverBots,
    canShowBotRoles: canTakeOverBots,
    shouldConfirmExit: status === GameStatus.Ongoing,
  };
}
