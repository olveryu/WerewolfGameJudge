/** Map generic room-command outcomes to the executable room-capability contract. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import type {
  RoomCommandDispatchOptions,
  RoomCommandDispatchOutcome,
} from '@/features/room/session/types';

export interface RoomOperationCommandContext<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
> {
  dispatch(
    command: TCommand,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>>;
}

function mapRoomOperationResult<TState extends BaseGameState<GameType>>(
  outcome: RoomCommandDispatchOutcome<TState>,
): RoomOperationResult {
  if (outcome.kind === 'superseded') {
    throw new Error(`Room command ${outcome.commandId} was superseded by another session`);
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

export async function dispatchRoomOperation<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
>(
  context: RoomOperationCommandContext<TState, TCommand>,
  command: TCommand,
  label: string,
): Promise<RoomOperationResult> {
  return mapRoomOperationResult(await context.dispatch(command, { controlledSeat: null, label }));
}
