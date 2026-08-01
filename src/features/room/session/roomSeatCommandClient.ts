/** Canonical seat-command client shared by every seated room game. */

import type { RoomSeatCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomCommandContext, RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { roomSessionLog } from '@/utils/logger';

export type RoomSeatCommandContext<
  TState extends BaseGameState<string>,
  TProfile,
> = RoomCommandContext<TState, RoomSeatCommand<TProfile>>;

async function dispatchSeatCommand<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  command: RoomSeatCommand<TProfile>,
  label: string,
): Promise<RoomCommandDispatchOutcome<TState>> {
  return context.dispatch(command, { controlledSeat: null, label });
}

export function takeRoomSeat<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  seat: number,
  profile: TProfile,
): Promise<RoomCommandDispatchOutcome<TState>> {
  roomSessionLog.debug('takeRoomSeat', { seat });
  return dispatchSeatCommand(context, { type: 'room.seat.take', seat, profile }, 'takeRoomSeat');
}

export function leaveRoomSeat<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<RoomCommandDispatchOutcome<TState>> {
  roomSessionLog.debug('leaveRoomSeat');
  return dispatchSeatCommand(context, { type: 'room.seat.leave' }, 'leaveRoomSeat');
}

export function kickRoomSeat<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  seat: number,
): Promise<RoomCommandDispatchOutcome<TState>> {
  roomSessionLog.debug('kickRoomSeat', { seat });
  return dispatchSeatCommand(context, { type: 'room.seat.kick', seat }, 'kickRoomSeat');
}

export function clearRoomSeats<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<RoomCommandDispatchOutcome<TState>> {
  roomSessionLog.debug('clearRoomSeats');
  return dispatchSeatCommand(context, { type: 'room.seat.clear' }, 'clearRoomSeats');
}

export function fillRoomSeatsWithBots<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<RoomCommandDispatchOutcome<TState>> {
  roomSessionLog.debug('fillRoomSeatsWithBots');
  return dispatchSeatCommand(context, { type: 'room.seat.fillBots' }, 'fillRoomSeatsWithBots');
}
