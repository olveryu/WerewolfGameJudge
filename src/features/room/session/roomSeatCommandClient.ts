/** Canonical seat-command client shared by every seated room game. */

import type { RoomSeatCommand } from '@werewolf/game-engine/platform/protocol/commands';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import type {
  RoomCommandDispatchOptions,
  RoomCommandDispatchOutcome,
} from '@/features/room/session/types';
import { roomSessionLog } from '@/utils/logger';

export interface RoomSeatCommandContext<TState extends BaseGameState<GameType>, TProfile> {
  dispatch(
    command: RoomSeatCommand<TProfile>,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>>;
}

function mapSeatCommandResult<TState extends BaseGameState<GameType>>(
  outcome: RoomCommandDispatchOutcome<TState>,
): RoomOperationResult {
  if (outcome.kind === 'superseded') {
    throw new Error(`Room seat command ${outcome.commandId} was superseded by another session`);
  }
  if (outcome.kind !== 'decided') {
    return {
      success: false,
      failureKind: outcome.kind,
      commandId: outcome.commandId,
      reason: outcome.reason,
    };
  }

  const { decision } = outcome;
  if (decision.kind === 'rejected') {
    return {
      success: false,
      failureKind: 'rejected',
      commandId: decision.commandId,
      reason: decision.reason,
    };
  }
  if (decision.outcome.kind === 'domainRejected') {
    return {
      success: false,
      failureKind: 'rejected',
      commandId: decision.commandId,
      reason: decision.outcome.reason,
    };
  }
  return decision.outcome.reason === undefined
    ? { success: true }
    : { success: true, reason: decision.outcome.reason };
}

async function dispatchSeatCommand<TState extends BaseGameState<GameType>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  command: RoomSeatCommand<TProfile>,
  label: string,
): Promise<RoomOperationResult> {
  return mapSeatCommandResult(await context.dispatch(command, { controlledSeat: null, label }));
}

export function takeRoomSeat<TState extends BaseGameState<GameType>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  seat: number,
  profile: TProfile,
): Promise<RoomOperationResult> {
  roomSessionLog.debug('takeRoomSeat', { seat });
  return dispatchSeatCommand(context, { type: 'room.seat.take', seat, profile }, 'takeRoomSeat');
}

export function leaveRoomSeat<TState extends BaseGameState<GameType>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<RoomOperationResult> {
  roomSessionLog.debug('leaveRoomSeat');
  return dispatchSeatCommand(context, { type: 'room.seat.leave' }, 'leaveRoomSeat');
}

export function kickRoomSeat<TState extends BaseGameState<GameType>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
  seat: number,
): Promise<RoomOperationResult> {
  roomSessionLog.debug('kickRoomSeat', { seat });
  return dispatchSeatCommand(context, { type: 'room.seat.kick', seat }, 'kickRoomSeat');
}

export function clearRoomSeats<TState extends BaseGameState<GameType>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<RoomOperationResult> {
  roomSessionLog.debug('clearRoomSeats');
  return dispatchSeatCommand(context, { type: 'room.seat.clear' }, 'clearRoomSeats');
}

export function fillRoomSeatsWithBots<TState extends BaseGameState<GameType>, TProfile>(
  context: RoomSeatCommandContext<TState, TProfile>,
): Promise<RoomOperationResult> {
  roomSessionLog.debug('fillRoomSeatsWithBots');
  return dispatchSeatCommand(context, { type: 'room.seat.fillBots' }, 'fillRoomSeatsWithBots');
}
