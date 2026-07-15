import {
  FIB_USED_WORD_LIMIT,
  fibEngine,
  type FibInternalCommand,
  type FibPublicCommand,
  type FibState,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_PREPARING,
  REASON_FIB_WORD_REUSED,
} from '@game-judge/game-engine/games/fibking/public';
import type { RoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { env } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapTestSchema } from '../../../../__tests__/testSchemaBootstrap';
import type { WorkerEffectContext } from '../../../workerModule';
import { handleFibGenerateWordEffect } from '../../effects';
import { createConfiguredFibWordProvider } from '..';
import { FIB_WORD_JSON_SCHEMA, parseFibWordCandidate } from '../candidate';
import { createGeminiFibWordProvider } from '../gemini';
import { createLocalFibWordProvider } from '../local';
import { LOCAL_FIB_WORD_BANK } from '../localWordBank';
import type { FibWordProvider } from '../types';
import { createWorkersAiFibWordProvider } from '../workersAi';

const ROOM_ID = 'fib-provider-room';
const ROOM_CODE = '9876';
const CREATION_ID = 'fib-provider-creation';

const EFFECT = {
  type: 'fib.word.generate',
  payload: { roundId: 'fib-round:start-command', avoidWords: [] },
} as const;

function applyPublicCommand(
  state: FibState,
  command: FibPublicCommand,
  commandId: string,
): FibState {
  const decision = fibEngine.decide(state, command, {
    actor: { kind: 'user', userId: 'host' },
    controlledSeat: null,
    nowMs: 2,
    commandId,
    randomSeed: `${commandId}-seed`,
  });
  if (decision.kind === 'reject') throw new Error(decision.reason);
  let nextState = state;
  for (const event of decision.events) nextState = fibEngine.evolve(nextState, event);
  return fibEngine.normalize(nextState);
}

function createPreparingState(startCommandId = 'start-command'): FibState {
  const lobby = fibEngine.createInitialState(
    { numberOfPlayers: 4 },
    { roomCode: ROOM_CODE, hostUserId: 'host', nowMs: 1, commandId: 'create-1' },
  );
  const full = applyPublicCommand(lobby, { type: 'room.seat.fillBots' }, 'fill-bots');
  const preparing = applyPublicCommand(full, { type: 'fib.round.start' }, startCommandId);
  if (preparing.phase !== 'preparing') throw new Error('Expected preparing Fib test state');
  return preparing;
}

function createEffectContext(
  dispatchInternal: WorkerEffectContext<FibState, FibInternalCommand>['dispatchInternal'],
  state: FibState = createPreparingState(),
): WorkerEffectContext<FibState, FibInternalCommand> {
  return {
    bindings: env,
    effectId: '9876:start-command:0',
    state,
    roomIdentity: {
      roomId: ROOM_ID,
      roomCode: ROOM_CODE,
      creationId: CREATION_ID,
    },
    createdRevision: 2,
    dispatchInternal,
    publishUserEvent: () => Promise.resolve(),
  };
}

function committedResult(commandId: string): RoomCommandResult<BaseGameState<'fibking'>> {
  const state = fibEngine.createInitialState(
    { numberOfPlayers: 4 },
    { roomCode: ROOM_CODE, hostUserId: 'host', nowMs: 1, commandId: 'create-1' },
  );
  return createRoomCommandResult({
    kind: 'committed',
    commandId,
    state,
    revision: 1,
    outcome: { kind: 'success' },
  });
}

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM fib_word_generation_results').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, game_type, host_user_id, creation_id, config_json, status,
      created_at, updated_at, games_started
    ) VALUES (?, ?, 'fibking', 'host', ?, '{"numberOfPlayers":4}', 'active', ?, ?, 0)`,
  )
    .bind(ROOM_ID, ROOM_CODE, CREATION_ID, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    .run();
});

describe('Fib word providers', () => {
  it('rejects an unknown deployment provider at the composition boundary', () => {
    expect(() =>
      createConfiguredFibWordProvider({ ...env, FIB_WORD_PROVIDER: 'invented-provider' }),
    ).toThrow('Unknown FIB_WORD_PROVIDER: invented-provider');
  });

  it('strictly validates, trims, and deduplicates every provider candidate', () => {
    expect(
      parseFibWordCandidate({ word: '  氤氲 ', definition: ' 烟气或云雾弥漫缭绕。 ' }, 'local', []),
    ).toEqual({ word: '氤氲', definition: '烟气或云雾弥漫缭绕。', source: 'local' });
    expect(() =>
      parseFibWordCandidate({ word: '氤氲', definition: '烟气或云雾弥漫缭绕。' }, 'local', [
        '氤氲',
      ]),
    ).toThrow('returned an avoided word');
    expect(() =>
      parseFibWordCandidate(
        { word: '氤氲', definition: '烟气或云雾弥漫缭绕。', extra: true },
        'local',
        [],
      ),
    ).toThrow();
  });

  it('keeps the local bank larger than the authoritative used-word window', async () => {
    expect(LOCAL_FIB_WORD_BANK.length).toBeGreaterThan(FIB_USED_WORD_LIMIT);
    for (const entry of LOCAL_FIB_WORD_BANK) {
      expect(parseFibWordCandidate(entry, 'local', [])).toEqual({ ...entry, source: 'local' });
    }
    const provider = createLocalFibWordProvider();
    const avoidWords = LOCAL_FIB_WORD_BANK.slice(0, FIB_USED_WORD_LIMIT).map((entry) => entry.word);
    await expect(provider.generate({ avoidWords })).resolves.toMatchObject({
      word: LOCAL_FIB_WORD_BANK[FIB_USED_WORD_LIMIT].word,
      source: 'local',
    });
  });

  it('uses Gemini structured output and rejects transport failures for outbox retry', async () => {
    let requestBody = '';
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (typeof init?.body !== 'string') {
        throw new Error('Expected Gemini request body to be a JSON string');
      }
      requestBody = init.body;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"word":"菡萏","definition":"尚未开放的荷花，也泛指荷花。"}',
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const provider = createGeminiFibWordProvider('test-key', fetchImpl);

    await expect(provider.generate({ avoidWords: ['氤氲'] })).resolves.toEqual({
      word: '菡萏',
      definition: '尚未开放的荷花，也泛指荷花。',
      source: 'gemini',
    });
    expect(requestBody).toContain('"type":"json_schema"');
    expect(requestBody).toContain('"additionalProperties":false');

    const failingFetch: typeof fetch = async () => new Response('unavailable', { status: 503 });
    await expect(
      createGeminiFibWordProvider('test-key', failingFetch).generate({ avoidWords: [] }),
    ).rejects.toThrow('Gemini Fib word request failed (503)');
  });

  it('uses a Workers AI model with a documented JSON Mode contract', async () => {
    let receivedModel = '';
    let receivedInput: unknown;
    const ai = {
      run: (model: string, input: unknown) => {
        receivedModel = model;
        receivedInput = input;
        return Promise.resolve({
          response: {
            word: '菡萏',
            definition: '尚未开放的荷花，也泛指荷花。',
          },
        });
      },
    } as unknown as Ai;

    await expect(createWorkersAiFibWordProvider(ai).generate({ avoidWords: [] })).resolves.toEqual({
      word: '菡萏',
      definition: '尚未开放的荷花，也泛指荷花。',
      source: 'workers-ai',
    });
    expect(receivedModel).toBe('@cf/meta/llama-3.1-8b-instruct-fast');
    expect(receivedInput).toMatchObject({
      max_tokens: 256,
      response_format: {
        type: 'json_schema',
        json_schema: FIB_WORD_JSON_SCHEMA,
      },
    });
  });
});

describe('Fib word-generation effect', () => {
  const provider: FibWordProvider = {
    generate: () =>
      Promise.resolve({
        word: '菡萏',
        definition: '尚未开放的荷花，也泛指荷花。',
        source: 'local',
      }),
  };

  it('replays the persisted candidate after an internal commit without regenerating it', async () => {
    const dispatchedCommands: FibInternalCommand[] = [];
    let dispatchedCommandId = '';
    let providerCallCount = 0;
    const replayProvider: FibWordProvider = {
      generate: () => {
        providerCallCount += 1;
        return Promise.resolve(
          providerCallCount === 1
            ? {
                word: '菡萏',
                definition: '尚未开放的荷花，也泛指荷花。',
                source: 'local',
              }
            : {
                word: '氤氲',
                definition: '烟气或云雾弥漫缭绕的样子。',
                source: 'local',
              },
        );
      },
    };
    const context = createEffectContext((commandId, command) => {
      dispatchedCommandId = commandId;
      dispatchedCommands.push(command);
      return Promise.resolve(committedResult(commandId));
    });

    await handleFibGenerateWordEffect(EFFECT, context, replayProvider);
    await handleFibGenerateWordEffect(EFFECT, context, replayProvider);

    expect(dispatchedCommandId).toMatch(/^fib:round-complete:[0-9a-f]{64}$/);
    expect(dispatchedCommandId.length).toBeLessThanOrEqual(200);
    expect(providerCallCount).toBe(1);
    expect(dispatchedCommands).toEqual([
      {
        type: 'fib.round.complete',
        roundId: 'fib-round:start-command',
        word: '菡萏',
        definition: '尚未开放的荷花，也泛指荷花。',
        source: 'local',
      },
      {
        type: 'fib.round.complete',
        roundId: 'fib-round:start-command',
        word: '菡萏',
        definition: '尚未开放的荷花，也泛指荷花。',
        source: 'local',
      },
    ]);
  });

  it('retires a stale effect before invoking the configured provider', async () => {
    let providerCallCount = 0;
    let dispatchCallCount = 0;
    const staleProvider: FibWordProvider = {
      generate: () => {
        providerCallCount += 1;
        return provider.generate({ avoidWords: [] });
      },
    };
    const lobby = fibEngine.createInitialState(
      { numberOfPlayers: 4 },
      { roomCode: ROOM_CODE, hostUserId: 'host', nowMs: 1, commandId: 'create-stale' },
    );
    const context = createEffectContext((commandId) => {
      dispatchCallCount += 1;
      return Promise.resolve(committedResult(commandId));
    }, lobby);

    await handleFibGenerateWordEffect(EFFECT, context, staleProvider);

    expect(providerCallCount).toBe(0);
    expect(dispatchCallCount).toBe(0);
  });

  it('fails fast when one effect identity is reused for a different round request', async () => {
    const firstContext = createEffectContext((commandId) =>
      Promise.resolve(committedResult(commandId)),
    );
    await handleFibGenerateWordEffect(EFFECT, firstContext, provider);

    const conflictingEffect = {
      type: 'fib.word.generate',
      payload: { roundId: 'fib-round:other-start', avoidWords: [] },
    } as const;
    const conflictingContext = createEffectContext(
      (commandId) => Promise.resolve(committedResult(commandId)),
      createPreparingState('other-start'),
    );
    await expect(
      handleFibGenerateWordEffect(conflictingEffect, conflictingContext, provider),
    ).rejects.toThrow('identity conflict');
  });

  it.each([REASON_FIB_ROUND_NOT_PREPARING, REASON_FIB_ROUND_MISMATCH])(
    'treats superseded round rejection %s as terminal cancellation',
    async (reason) => {
      const context = createEffectContext((commandId) =>
        Promise.resolve({ kind: 'rejected', commandId, reason }),
      );
      await expect(handleFibGenerateWordEffect(EFFECT, context, provider)).resolves.toBeUndefined();
    },
  );

  it('propagates every non-cancellation rejection to the outbox retry policy', async () => {
    const context = createEffectContext((commandId) =>
      Promise.resolve({ kind: 'rejected', commandId, reason: REASON_FIB_WORD_REUSED }),
    );
    await expect(handleFibGenerateWordEffect(EFFECT, context, provider)).rejects.toThrow(
      'was rejected: fib_word_reused',
    );
  });
});
