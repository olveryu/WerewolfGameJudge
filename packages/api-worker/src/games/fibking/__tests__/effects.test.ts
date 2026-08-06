/** FibKing Worker effect replay contracts across authoritative stage transitions. */

import {
  FIB_PREPARATION_STAGES,
  type FibCommand,
  type FibEffect,
  fibEngine,
  type FibGenerateWordEffect,
  type FibInternalCommand,
  type FibState,
} from '@game-judge/game-engine/games/fibking/public';
import type { CommandContext, CreateGameContext } from '@game-judge/game-engine/platform/engine';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { ensureFibSelectingWordStage, handleFibGenerateWordEffect } from '../effects';

const ROOM_ID = 'fib-effect-room-id';
const ROOM_CODE = '7319';
const ROOM_CREATION_ID = 'fib-effect-creation-id';
const HOST_USER_ID = 'fib-effect-host';
const EFFECT_ID = 'fib-effect-resume-selecting-word';

interface FibDispatchResult {
  readonly state: FibState;
  readonly effects: readonly FibEffect[];
}

function createContext(): CreateGameContext {
  return {
    roomCode: ROOM_CODE,
    hostUserId: HOST_USER_ID,
    nowMs: 1_000,
    commandId: 'fib-effect-create',
  };
}

function userContext(commandId: string): CommandContext {
  return {
    actor: { kind: 'user', userId: HOST_USER_ID },
    controlledSeat: null,
    nowMs: 2_000,
    commandId,
    randomSeed: commandId,
  };
}

function systemContext(commandId: string): CommandContext {
  return {
    actor: { kind: 'system', effectId: EFFECT_ID },
    controlledSeat: null,
    nowMs: 3_000,
    commandId,
    randomSeed: commandId,
  };
}

function dispatchFib(
  state: FibState,
  command: FibCommand,
  context: CommandContext,
): FibDispatchResult {
  const decision = fibEngine.decide(state, command, context);
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Fib command, received ${decision.reason}`);
  }
  let nextState = state;
  for (const event of decision.events) {
    nextState = fibEngine.evolve(nextState, event);
  }
  return { state: fibEngine.normalize(nextState), effects: decision.effects };
}

function createQueuedScenario(): {
  readonly state: FibState;
  readonly effect: FibGenerateWordEffect;
} {
  let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, createContext());
  state = dispatchFib(
    state,
    {
      type: 'room.seat.take',
      seat: 0,
      profile: { displayName: '房主' },
    },
    userContext('fib-effect-seat-host'),
  ).state;
  state = dispatchFib(
    state,
    { type: 'room.seat.fillBots' },
    userContext('fib-effect-fill-bots'),
  ).state;
  const started = dispatchFib(
    state,
    { type: 'fib.round.start' },
    userContext('fib-effect-start-round'),
  );
  const effect = started.effects[0];
  if (effect === undefined || effect.type !== 'fib.word.generate') {
    throw new Error('Expected Fib word effect');
  }
  if (started.state.phase !== 'preparing') throw new Error('Expected preparing Fib state');
  return { state: started.state, effect };
}

function createSelectingWordScenario(): {
  readonly state: FibState;
  readonly effect: FibGenerateWordEffect;
} {
  const queued = createQueuedScenario();
  if (queued.state.phase !== 'preparing') throw new Error('Expected preparing Fib state');
  const selecting = dispatchFib(
    queued.state,
    {
      type: 'fib.round.updatePreparationStage',
      roundId: queued.state.pendingRound.roundId,
      stage: FIB_PREPARATION_STAGES.selectingWord,
    },
    systemContext('fib-effect-selecting-word'),
  ).state;
  return { state: selecting, effect: queued.effect };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM rooms WHERE id = ? OR code = ?').bind(ROOM_ID, ROOM_CODE).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(HOST_USER_ID).run();
  await env.DB.prepare('INSERT INTO users (id) VALUES (?)').bind(HOST_USER_ID).run();
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, game_type, host_user_id, creation_id, config_json, status,
      created_at, updated_at, games_started
    ) VALUES (?, ?, 'fibking', ?, ?, '{"numberOfPlayers":4}', 'active', ?, ?, 0)`,
  )
    .bind(
      ROOM_ID,
      ROOM_CODE,
      HOST_USER_ID,
      ROOM_CREATION_ID,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    )
    .run();
});

describe('FibKing word effect replay', () => {
  it('advances an active queued effect to the selecting-word stage', async () => {
    const scenario = createQueuedScenario();
    const dispatchedCommands: FibInternalCommand[] = [];
    let currentState = scenario.state;
    const context: WorkerEffectContext<FibState, FibInternalCommand> = {
      bindings: env,
      effectId: EFFECT_ID,
      state: scenario.state,
      roomIdentity: {
        roomId: ROOM_ID,
        roomCode: ROOM_CODE,
        creationId: ROOM_CREATION_ID,
      },
      createdRevision: 4,
      dispatchInternal: async (commandId, command) => {
        dispatchedCommands.push(command);
        const dispatched = dispatchFib(currentState, command, systemContext(commandId));
        currentState = dispatched.state;
        return createRoomCommandResult({
          kind: 'committed',
          commandId,
          state: currentState,
          revision: 5,
          outcome: { kind: 'success' },
        });
      },
      publishUserEvent: async () => {},
    };

    await expect(ensureFibSelectingWordStage(scenario.effect, context)).resolves.toBe(true);
    expect(dispatchedCommands).toEqual([
      {
        type: 'fib.round.updatePreparationStage',
        roundId: scenario.effect.payload.roundId,
        stage: FIB_PREPARATION_STAGES.selectingWord,
      },
    ]);
    expect(currentState.phase).toBe('preparing');
    if (currentState.phase !== 'preparing') throw new Error('Expected preparing Fib state');
    expect(currentState.pendingRound.stage).toBe(FIB_PREPARATION_STAGES.selectingWord);
  });

  it('resumes catalog selection without repeating the selecting-word command', async () => {
    const scenario = createSelectingWordScenario();
    const dispatchedCommands: FibInternalCommand[] = [];
    let currentState = scenario.state;
    let revision = 5;
    const context: WorkerEffectContext<FibState, FibInternalCommand> = {
      bindings: env,
      effectId: EFFECT_ID,
      state: scenario.state,
      roomIdentity: {
        roomId: ROOM_ID,
        roomCode: ROOM_CODE,
        creationId: ROOM_CREATION_ID,
      },
      createdRevision: 4,
      dispatchInternal: async (commandId, command) => {
        dispatchedCommands.push(command);
        const dispatched = dispatchFib(currentState, command, systemContext(commandId));
        currentState = dispatched.state;
        revision += 1;
        return createRoomCommandResult({
          kind: 'committed',
          commandId,
          state: currentState,
          revision,
          outcome: { kind: 'success' },
        });
      },
      publishUserEvent: async () => {},
    };

    await expect(handleFibGenerateWordEffect(scenario.effect, context)).resolves.toEqual({
      kind: 'success',
    });
    expect(dispatchedCommands).toHaveLength(1);
    expect(dispatchedCommands[0]?.type).toBe('fib.round.complete');
    expect(currentState.phase).toBe('ongoing');
  });
});
