/** Canonical dispatch outcomes for client tests. */

import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { DispatchOutcome } from '@/platform/realtime/types';

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

function committed<TState extends BaseGameState<string>>(
  state: TState,
  commandId: string,
  revision: number,
  outcome: { kind: 'success'; reason?: string } | { kind: 'domainRejected'; reason: string },
): DispatchOutcome<TState> {
  const decision = createRoomCommandResult({
    kind: 'committed',
    commandId,
    state,
    revision,
    outcome,
  });
  if (decision.kind !== 'committed') throw new Error('expected a committed decision');
  return {
    kind: 'committed',
    commandId: decision.commandId,
    snapshot: decision.snapshot,
    outcome: decision.outcome,
  };
}

export function successfulRoomCommand<TState extends BaseGameState<string>>(
  state: TState,
  commandId = 'test-command',
  revision = 1,
  reason?: string,
): DispatchOutcome<TState> {
  return committed(
    state,
    commandId,
    revision,
    reason === undefined ? { kind: 'success' } : { kind: 'success', reason },
  );
}

export function domainRejectedRoomCommand<TState extends BaseGameState<string>>(
  state: TState,
  reason: string,
  commandId = 'test-command',
  revision = 1,
): DispatchOutcome<TState> {
  return committed(state, commandId, revision, { kind: 'domainRejected', reason });
}

export function rejectedRoomCommand<TState extends BaseGameState<string>>(
  reason: string,
  commandId = 'test-command',
): DispatchOutcome<TState> {
  return { kind: 'rejected', commandId, reason };
}

export function undeliveredRoomCommand<TState extends BaseGameState<string>>(
  cause: 'network' | 'timeout' | 'server' = 'network',
  commandId = 'test-command',
): DispatchOutcome<TState> {
  return { kind: 'undelivered', commandId, cause };
}
