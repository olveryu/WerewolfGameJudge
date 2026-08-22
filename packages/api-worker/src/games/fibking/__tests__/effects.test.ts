/** FibKing word-selection effect retry and terminal-failure contracts. */

import {
  fibEngine,
  type FibInternalCommand,
  type FibPublicCommand,
  type FibSelectWordEffect,
  type FibState,
} from '@game-judge/game-engine/games/fibking/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { OUTBOX_MAX_ATTEMPTS } from '../../../platform/room/effectOutbox';
import { handleFibEffect } from '../effects';

const EFFECT: FibSelectWordEffect = {
  type: 'fib.word.select',
  payload: { roundId: 'fib-round:start-command', avoidWords: [] },
};

function applyPublicCommand(
  state: FibState,
  command: FibPublicCommand,
  commandId: string,
  nowMs: number,
): FibState {
  const decision = fibEngine.decide(state, command, {
    actor: { kind: 'user', userId: 'host' },
    controlledSeat: null,
    nowMs,
    commandId,
    randomSeed: `${commandId}-seed`,
  });
  if (decision.kind === 'reject') throw new Error(decision.reason);
  let nextState = state;
  for (const event of decision.events) nextState = fibEngine.evolve(nextState, event);
  return fibEngine.normalize(nextState);
}

function createPreparingState(): FibState {
  const lobby = fibEngine.createInitialState(
    { numberOfPlayers: 4 },
    { roomCode: '4321', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  const full = applyPublicCommand(lobby, { type: 'room.seat.fillBots' }, 'fill-bots', 2);
  return applyPublicCommand(full, { type: 'fib.round.start' }, 'start-command', 3);
}

function createContext(
  deliveryAttemptCount: number,
  commands: FibInternalCommand[],
): WorkerEffectContext<FibState, FibInternalCommand> {
  const state = createPreparingState();
  return {
    bindings: env,
    effectId: 'missing-room-effect',
    state,
    roomIdentity: {
      roomId: 'missing-room-id',
      roomCode: '4321',
      creationId: 'missing-room-creation',
    },
    createdRevision: 2,
    deliveryAttemptCount,
    dispatchInternal: (commandId, command) => {
      commands.push(command);
      return Promise.resolve(
        createRoomCommandResult({
          kind: 'committed',
          commandId,
          state,
          revision: 2,
          outcome: { kind: 'success' },
        }),
      );
    },
    publishUserEvent: () => Promise.resolve(),
  };
}

describe('handleFibEffect selection retries', () => {
  it('propagates selection persistence failure before the final delivery attempt', async () => {
    const commands: FibInternalCommand[] = [];

    await expect(handleFibEffect(EFFECT, createContext(1, commands))).rejects.toThrow(
      'selection was not persisted',
    );
    expect(commands).toEqual([
      {
        type: 'fib.round.updatePreparationStage',
        roundId: EFFECT.payload.roundId,
        stage: 'selecting',
      },
    ]);
  });

  it('commits a visible failure on the final delivery attempt', async () => {
    const commands: FibInternalCommand[] = [];

    await expect(
      handleFibEffect(EFFECT, createContext(OUTBOX_MAX_ATTEMPTS, commands)),
    ).resolves.toBeUndefined();
    expect(commands).toEqual([
      {
        type: 'fib.round.updatePreparationStage',
        roundId: EFFECT.payload.roundId,
        stage: 'selecting',
      },
      {
        type: 'fib.round.failPreparation',
        roundId: EFFECT.payload.roundId,
        failureCode: 'selectionFailed',
      },
    ]);
  });
});
