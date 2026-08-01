/** Canonical room-command envelopes for client tests. */

import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';

export function testRoomState<TGameType extends string>(
  gameType: TGameType,
): BaseGameState<TGameType> {
  return {
    gameType,
    stateVersion: 1,
    roomCode: 'test-room',
    hostUserId: 'test-host',
  };
}

export function successfulRoomCommand<TState extends BaseGameState<string>>(
  state: TState,
  commandId = 'test-command',
  revision = 1,
  reason?: string,
): RoomCommandDispatchOutcome<TState> {
  return {
    kind: 'decided',
    decision: createRoomCommandResult({
      kind: 'committed',
      commandId,
      state,
      revision,
      outcome: reason === undefined ? { kind: 'success' } : { kind: 'success', reason },
    }),
  };
}

export function domainRejectedRoomCommand<TState extends BaseGameState<string>>(
  state: TState,
  reason: string,
  commandId = 'test-command',
  revision = 1,
): RoomCommandDispatchOutcome<TState> {
  return {
    kind: 'decided',
    decision: createRoomCommandResult({
      kind: 'committed',
      commandId,
      state,
      revision,
      outcome: { kind: 'domainRejected', reason },
    }),
  };
}

export function rejectedRoomCommand<TState extends BaseGameState<string>>(
  reason: string,
  commandId = 'test-command',
): RoomCommandDispatchOutcome<TState> {
  return {
    kind: 'decided',
    decision: createRoomCommandResult({ kind: 'rejected', commandId, reason }),
  };
}
