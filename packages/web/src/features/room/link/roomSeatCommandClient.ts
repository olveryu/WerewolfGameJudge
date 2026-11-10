/** Canonical seat-command client shared by every seated room game. */

import type { RoomSeatCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { DispatchOptions, DispatchOutcome } from '@/platform/realtime/types';
import { roomSessionLog } from '@/utils/logger';

/** The dispatch surface a command client needs; satisfied by `RoomLink`. */
export interface RoomCommandContext<TState extends BaseGameState<string>, TCommand extends object> {
  dispatch(command: TCommand, options: DispatchOptions): Promise<DispatchOutcome<TState>>;
}

export type RoomSeatCommandContext<
  TState extends BaseGameState<string>,
  TProfile,
> = RoomCommandContext<TState, RoomSeatCommand<TProfile>>;

function dispatchSeatCommand<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  command: RoomSeatCommand<TProfile>,
  label: string,
): Promise<DispatchOutcome<TState>> {
  return context.dispatch(command, { controlledSeat: null, label, durable: false });
}

export function takeRoomSeat<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  seat: number,
  profile: TProfile,
): Promise<DispatchOutcome<TState>> {
  roomSessionLog.debug('takeRoomSeat', { seat });
  return dispatchSeatCommand(context, { type: 'room.seat.take', seat, profile }, '入座');
}

export function leaveRoomSeat<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<DispatchOutcome<TState>> {
  roomSessionLog.debug('leaveRoomSeat');
  return dispatchSeatCommand(context, { type: 'room.seat.leave' }, '离座');
}

export function kickRoomSeat<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  seat: number,
): Promise<DispatchOutcome<TState>> {
  roomSessionLog.debug('kickRoomSeat', { seat });
  return dispatchSeatCommand(context, { type: 'room.seat.kick', seat }, '请离玩家');
}

export function clearRoomSeats<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<DispatchOutcome<TState>> {
  roomSessionLog.debug('clearRoomSeats');
  return dispatchSeatCommand(context, { type: 'room.seat.clear' }, '清空座位');
}

export function fillRoomSeatsWithBots<TState extends BaseGameState<string>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<DispatchOutcome<TState>> {
  roomSessionLog.debug('fillRoomSeatsWithBots');
  return dispatchSeatCommand(context, { type: 'room.seat.fillBots' }, '填充机器人');
}
