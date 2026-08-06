import {
  FIB_PREPARATION_STAGES,
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
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkerEffectContext } from '../../../../platform/gameModules/workerModule';
import { handleFibGenerateWordEffect } from '../../effects';
import { FIB_PREPARATION_TIMEOUT_MS } from '../../wordGenerationResults';
import { readRecentFibWords, recordFibWordExposure } from '../../wordHistory';
import { createConfiguredFibWordProvider, createGeminiPrimaryFibWordProvider } from '..';
import {
  FIB_WORD_JSON_SCHEMA,
  parseFibWordCandidate,
  parseGeneratedFibWordCandidate,
} from '../candidate';
import { createGeminiFibWordProvider } from '../gemini';
import { createLocalFibWordProvider } from '../local';
import { LOCAL_FIB_WORD_BANK } from '../localWordBank';
import { FibWordProviderError } from '../providerError';
import type { FibWordProvider, FibWordRequest } from '../types';
import { createWorkersAiFibWordProvider } from '../workersAi';

const ROOM_ID = 'fib-provider-room';
const ROOM_CODE = '9876';
const CREATION_ID = 'fib-provider-creation';
const TEST_GENERATION_BUDGET_MS = 60_000;

const EFFECT = {
  type: 'fib.word.generate',
  payload: { roundId: 'fib-round:start-command', avoidWords: [] },
} as const;

const AI_DEFINITION = {
  coreMeaning: '尚未开放的荷花花苞，也可以用来泛指荷花。',
  usageNote: '多见于书面语和文学描写，常用来营造含蓄雅致的意象。',
} as const;

const MIST_DEFINITION = {
  coreMeaning: '烟气或云雾在空气中弥漫缭绕的朦胧景象。',
  usageNote: '常用于描写云烟、水汽或光线交织形成的柔和氛围。',
} as const;

const AI_CANDIDATE = {
  word: '菡萏',
  definition: AI_DEFINITION,
  category: 'literary',
} as const;

function createWordRequest(overrides: Partial<FibWordRequest> = {}): FibWordRequest {
  return {
    avoidWords: [],
    recentWords: [],
    selectionSeed: 'fib-provider-test-seed',
    category: 'literary',
    generationDeadlineAt: Date.now() + TEST_GENERATION_BUDGET_MS,
    signal: new AbortController().signal,
    ...overrides,
  };
}

const AI_WORD_REQUEST = createWordRequest({
  avoidWords: ['氤氲'],
  recentWords: ['电子榨菜'],
});

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

function createPreparingState(
  startCommandId = 'start-command',
  requestedAt = Date.now(),
): FibState {
  const lobby = fibEngine.createInitialState(
    { numberOfPlayers: 4 },
    {
      roomCode: ROOM_CODE,
      hostUserId: 'host',
      nowMs: requestedAt - 2,
      commandId: 'create-1',
    },
  );
  const full = applyPublicCommand(
    lobby,
    { type: 'room.seat.fillBots' },
    'fill-bots',
    requestedAt - 1,
  );
  const preparing = applyPublicCommand(
    full,
    { type: 'fib.round.start' },
    startCommandId,
    requestedAt,
  );
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

function committedResult(commandId: string): RoomCommandResult<FibState> {
  const state = createPreparingState();
  return createRoomCommandResult({
    kind: 'committed',
    commandId,
    state,
    revision: 1,
    outcome: { kind: 'success' },
  });
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM fib_word_generation_results').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id = 'host'").run();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, is_anonymous, created_at, updated_at)
         VALUES ('host', 1, ?, ?)`,
    ).bind('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    env.DB.prepare(
      `INSERT INTO rooms (
          id, code, game_type, host_user_id, creation_id, config_json, status,
          created_at, updated_at, games_started
        ) VALUES (?, ?, 'fibking', 'host', ?, '{"numberOfPlayers":4}', 'active', ?, ?, 0)`,
    ).bind(ROOM_ID, ROOM_CODE, CREATION_ID, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ]);
});

describe('Fib word providers', () => {
  it('rejects an unknown deployment provider at the composition boundary', () => {
    expect(() =>
      createConfiguredFibWordProvider({ ...env, FIB_WORD_PROVIDER: 'invented-provider' }),
    ).toThrow('Unknown FIB_WORD_PROVIDER: invented-provider');
    expect(() =>
      createConfiguredFibWordProvider({ ...env, FIB_WORD_PROVIDER: 'workers-ai' }),
    ).toThrow('Unknown FIB_WORD_PROVIDER: workers-ai');
  });

  it('falls back from Gemini to Workers AI at most once for an eligible failure', async () => {
    let geminiCallCount = 0;
    let workersAiCallCount = 0;
    const geminiRequests: FibWordRequest[] = [];
    const workersAiRequests: FibWordRequest[] = [];
    const geminiProvider: FibWordProvider = {
      generate: (request) => {
        geminiCallCount += 1;
        geminiRequests.push(request);
        return Promise.reject(
          new FibWordProviderError('Gemini temporarily unavailable', 'serviceUnavailable'),
        );
      },
    };
    const workersAiProvider: FibWordProvider = {
      generate: (request) => {
        workersAiCallCount += 1;
        workersAiRequests.push(request);
        return Promise.resolve({
          word: AI_CANDIDATE.word,
          definition: AI_CANDIDATE.definition,
          source: 'workers-ai',
        });
      },
    };
    const request = createWordRequest();

    await expect(
      createGeminiPrimaryFibWordProvider(geminiProvider, workersAiProvider).generate(request),
    ).resolves.toEqual({
      word: AI_CANDIDATE.word,
      definition: AI_CANDIDATE.definition,
      source: 'workers-ai',
    });

    expect(geminiCallCount).toBe(1);
    expect(workersAiCallCount).toBe(1);
    expect(geminiRequests[0]).toMatchObject({
      generationDeadlineAt: request.generationDeadlineAt,
    });
    expect(workersAiRequests[0]).toMatchObject({
      generationDeadlineAt: request.generationDeadlineAt,
    });
    expect(geminiRequests[0]?.signal).not.toBe(request.signal);
    expect(workersAiRequests[0]?.signal).not.toBe(request.signal);
  });

  it('does not fall back for a non-eligible Gemini request failure', async () => {
    let workersAiCallCount = 0;
    const geminiProvider: FibWordProvider = {
      generate: () =>
        Promise.reject(new FibWordProviderError('Gemini authentication failed', 'requestFailed')),
    };
    const workersAiProvider: FibWordProvider = {
      generate: () => {
        workersAiCallCount += 1;
        return Promise.resolve({
          word: AI_CANDIDATE.word,
          definition: AI_CANDIDATE.definition,
          source: 'workers-ai',
        });
      },
    };

    await expect(
      createGeminiPrimaryFibWordProvider(geminiProvider, workersAiProvider).generate(
        createWordRequest(),
      ),
    ).rejects.toMatchObject({ failureKind: 'requestFailed' });
    expect(workersAiCallCount).toBe(0);
  });

  it('does not invoke either provider after the shared generation deadline', async () => {
    let providerCallCount = 0;
    const provider: FibWordProvider = {
      generate: () => {
        providerCallCount += 1;
        return Promise.resolve({
          word: AI_CANDIDATE.word,
          definition: AI_CANDIDATE.definition,
          source: 'gemini',
        });
      },
    };

    await expect(
      createGeminiPrimaryFibWordProvider(provider, provider).generate(
        createWordRequest({ generationDeadlineAt: Date.now() - 1 }),
      ),
    ).rejects.toMatchObject({ failureKind: 'timedOut' });
    expect(providerCallCount).toBe(0);
  });

  it('strictly validates, trims, and deduplicates every provider candidate', () => {
    expect(
      parseFibWordCandidate(
        {
          word: '  氤氲 ',
          definition: {
            coreMeaning: ` ${MIST_DEFINITION.coreMeaning} `,
            usageNote: ` ${MIST_DEFINITION.usageNote} `,
          },
        },
        'local',
        [],
      ),
    ).toEqual({ word: '氤氲', definition: MIST_DEFINITION, source: 'local' });
    expect(() =>
      parseFibWordCandidate({ word: '氤氲', definition: MIST_DEFINITION }, 'local', ['氤氲']),
    ).toThrow('returned an avoided word');
    expect(() =>
      parseFibWordCandidate(
        { word: '氤氲', definition: MIST_DEFINITION, extra: true },
        'local',
        [],
      ),
    ).toThrow();
    expect(() =>
      parseFibWordCandidate(
        {
          word: '氤氲',
          definition: {
            ...MIST_DEFINITION,
            coreMeaning: 'A cloud of mist drifting through the air.',
          },
        },
        'gemini',
        [],
      ),
    ).toThrow();
    expect(() =>
      parseFibWordCandidate(
        {
          word: '氤氲',
          definition: {
            ...MIST_DEFINITION,
            usageNote: '常用于描写空气中有 soft drifting mist 的景象。',
          },
        },
        'gemini',
        [],
      ),
    ).toThrow();
    expect(() =>
      parseFibWordCandidate({ word: 'serendipity', definition: MIST_DEFINITION }, 'gemini', []),
    ).toThrow();
    expect(() =>
      parseFibWordCandidate(
        { word: '氤氲', definition: { coreMeaning: MIST_DEFINITION.coreMeaning } },
        'gemini',
        [],
      ),
    ).toThrow();
  });

  it('validates one candidate against the server-selected category and word history', () => {
    expect(parseGeneratedFibWordCandidate(AI_CANDIDATE, 'workers-ai', AI_WORD_REQUEST)).toEqual({
      word: AI_CANDIDATE.word,
      definition: AI_CANDIDATE.definition,
      source: 'workers-ai',
    });
    expect(() =>
      parseGeneratedFibWordCandidate(
        { ...AI_CANDIDATE, category: 'internet' },
        'workers-ai',
        AI_WORD_REQUEST,
      ),
    ).toThrow('expected literary');
    expect(() =>
      parseGeneratedFibWordCandidate(
        { ...AI_CANDIDATE, word: '电子榨菜' },
        'workers-ai',
        AI_WORD_REQUEST,
      ),
    ).toThrow('returned a recent word');
  });

  it('keeps the local bank larger than the authoritative used-word window', async () => {
    expect(LOCAL_FIB_WORD_BANK.length).toBeGreaterThan(FIB_USED_WORD_LIMIT);
    for (const entry of LOCAL_FIB_WORD_BANK) {
      expect(parseFibWordCandidate(entry, 'local', [])).toEqual({ ...entry, source: 'local' });
    }
    const provider = createLocalFibWordProvider();
    const avoidWords = LOCAL_FIB_WORD_BANK.slice(0, FIB_USED_WORD_LIMIT).map((entry) => entry.word);
    const recentWords = LOCAL_FIB_WORD_BANK.slice(FIB_USED_WORD_LIMIT + 1).map(
      (entry) => entry.word,
    );
    await expect(
      provider.generate(
        createWordRequest({ avoidWords, recentWords, selectionSeed: 'local-target-seed' }),
      ),
    ).resolves.toMatchObject({
      word: LOCAL_FIB_WORD_BANK[FIB_USED_WORD_LIMIT].word,
      source: 'local',
    });

    const rotated = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        provider.generate(createWordRequest({ selectionSeed: `local-rotation-${index}` })),
      ),
    );
    expect(new Set(rotated.map((candidate) => candidate.word)).size).toBeGreaterThan(1);
  });

  it('uses Gemini structured output and rejects transport failures for outbox retry', async () => {
    let requestBody = '';
    let requestSignal: AbortSignal | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (typeof init?.body !== 'string') {
        throw new Error('Expected Gemini request body to be a JSON string');
      }
      requestBody = init.body;
      requestSignal = init.signal ?? null;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(AI_CANDIDATE),
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const provider = createGeminiFibWordProvider('test-key', fetchImpl);

    await expect(provider.generate(AI_WORD_REQUEST)).resolves.toEqual({
      word: '菡萏',
      definition: AI_DEFINITION,
      source: 'gemini',
    });
    expect(requestBody).toContain('"type":"json_schema"');
    expect(requestBody).toContain('"additionalProperties":false');
    expect(requestBody).toContain('"max_tokens":256');
    expect(requestBody).not.toContain('"candidates"');
    expect(requestSignal).toBe(AI_WORD_REQUEST.signal);

    const failingFetch: typeof fetch = async () => new Response('unavailable', { status: 503 });
    await expect(
      createGeminiFibWordProvider('test-key', failingFetch).generate(createWordRequest()),
    ).rejects.toThrow('Gemini Fib word request failed (503)');
  });

  it('uses a Workers AI model with a documented JSON Mode contract', async () => {
    let receivedModel = '';
    let receivedInput: unknown;
    let receivedSignal: AbortSignal | null = null;
    const run = (
      model: string,
      input: Record<string, unknown>,
      options: { readonly signal: AbortSignal },
    ) => {
      receivedModel = model;
      receivedInput = input;
      receivedSignal = options.signal;
      return Promise.resolve({
        response: AI_CANDIDATE,
      });
    };

    await expect(createWorkersAiFibWordProvider(run).generate(AI_WORD_REQUEST)).resolves.toEqual({
      word: '菡萏',
      definition: AI_DEFINITION,
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
    expect(receivedSignal).toBe(AI_WORD_REQUEST.signal);
  });
});

describe('Fib word-generation effect', () => {
  const provider: FibWordProvider = {
    generate: () =>
      Promise.resolve({
        word: '菡萏',
        definition: AI_DEFINITION,
        source: 'local',
      }),
  };

  it('replays a persisted candidate after the deadline without regenerating it', async () => {
    const dispatchedCommands: FibInternalCommand[] = [];
    const dispatchedCommandIds: string[] = [];
    let providerCallCount = 0;
    const replayProvider: FibWordProvider = {
      generate: () => {
        providerCallCount += 1;
        return Promise.resolve(
          providerCallCount === 1
            ? {
                word: '菡萏',
                definition: AI_DEFINITION,
                source: 'local',
              }
            : {
                word: '氤氲',
                definition: MIST_DEFINITION,
                source: 'local',
              },
        );
      },
    };
    const requestedAt = Date.now();
    const context = createEffectContext(
      (commandId, command) => {
        dispatchedCommandIds.push(commandId);
        dispatchedCommands.push(command);
        return Promise.resolve(committedResult(commandId));
      },
      createPreparingState('start-command', requestedAt),
    );
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(requestedAt + 100);

    try {
      await handleFibGenerateWordEffect(EFFECT, context, replayProvider);
      nowSpy.mockReturnValue(requestedAt + FIB_PREPARATION_TIMEOUT_MS + 1);
      await handleFibGenerateWordEffect(EFFECT, context, replayProvider);
    } finally {
      nowSpy.mockRestore();
    }

    expect(dispatchedCommandIds).toEqual([
      expect.stringMatching(/^fib:preparation-stage-generating:[0-9a-f]{64}$/),
      expect.stringMatching(/^fib:preparation-stage-finalizing:[0-9a-f]{64}$/),
      expect.stringMatching(/^fib:round-complete:[0-9a-f]{64}$/),
      expect.stringMatching(/^fib:preparation-stage-generating:[0-9a-f]{64}$/),
      expect.stringMatching(/^fib:preparation-stage-finalizing:[0-9a-f]{64}$/),
      expect.stringMatching(/^fib:round-complete:[0-9a-f]{64}$/),
    ]);
    expect(dispatchedCommandIds.slice(0, 3)).toEqual(dispatchedCommandIds.slice(3));
    expect(new Set(dispatchedCommandIds.slice(0, 3)).size).toBe(3);
    expect(dispatchedCommandIds.every((commandId) => commandId.length <= 200)).toBe(true);
    expect(providerCallCount).toBe(1);
    expect(dispatchedCommands).toEqual([
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.generating,
      },
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.finalizing,
      },
      {
        type: 'fib.round.complete',
        roundId: 'fib-round:start-command',
        word: '菡萏',
        definition: AI_DEFINITION,
        source: 'local',
      },
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.generating,
      },
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.finalizing,
      },
      {
        type: 'fib.round.complete',
        roundId: 'fib-round:start-command',
        word: '菡萏',
        definition: AI_DEFINITION,
        source: 'local',
      },
    ]);
  });

  it('passes participant history to generation and records only a successful round', async () => {
    await recordFibWordExposure(env.DB, ['host'], '阒寂', '2026-01-01T00:00:00.000Z');
    let receivedRequest: FibWordRequest | null = null;
    const historyProvider: FibWordProvider = {
      generate: (request) => {
        receivedRequest = request;
        return Promise.resolve({
          word: '菡萏',
          definition: AI_DEFINITION,
          source: 'local',
        });
      },
    };
    const context = createEffectContext((commandId) => Promise.resolve(committedResult(commandId)));

    await handleFibGenerateWordEffect(EFFECT, context, historyProvider);

    expect(receivedRequest).toMatchObject({
      avoidWords: [],
      recentWords: ['阒寂'],
      selectionSeed: 'fib-round:start-command',
    });
    await expect(readRecentFibWords(env.DB, ['host'])).resolves.toEqual(['菡萏', '阒寂']);
  });

  it('commits terminal generation failure when provider output validation fails', async () => {
    const failingProvider: FibWordProvider = {
      generate: () =>
        Promise.reject(new FibWordProviderError('Provider output was invalid', 'invalidOutput')),
    };
    const dispatchedCommands: FibInternalCommand[] = [];
    const context = createEffectContext((commandId, command) => {
      dispatchedCommands.push(command);
      return Promise.resolve(committedResult(commandId));
    });

    await expect(
      handleFibGenerateWordEffect(EFFECT, context, failingProvider),
    ).resolves.toBeUndefined();
    expect(dispatchedCommands).toEqual([
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.generating,
      },
      {
        type: 'fib.round.failPreparation',
        roundId: 'fib-round:start-command',
        failureCode: 'generationFailed',
      },
    ]);
    await expect(
      env.DB.prepare('SELECT core_meaning FROM fib_word_generation_results LIMIT 1').first(),
    ).resolves.toBeNull();
  });

  it('times out from the original request without invoking a provider', async () => {
    let providerCallCount = 0;
    const timeoutProvider: FibWordProvider = {
      generate: () => {
        providerCallCount += 1;
        return provider.generate(createWordRequest());
      },
    };
    const dispatchedCommands: FibInternalCommand[] = [];
    const expiredState = createPreparingState(
      'start-command',
      Date.now() - FIB_PREPARATION_TIMEOUT_MS - 1,
    );
    const context = createEffectContext((commandId, command) => {
      dispatchedCommands.push(command);
      return Promise.resolve(committedResult(commandId));
    }, expiredState);

    await expect(
      handleFibGenerateWordEffect(EFFECT, context, timeoutProvider),
    ).resolves.toBeUndefined();

    expect(providerCallCount).toBe(0);
    expect(dispatchedCommands).toEqual([
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.generating,
      },
      {
        type: 'fib.round.failPreparation',
        roundId: 'fib-round:start-command',
        failureCode: 'timedOut',
      },
    ]);
  });

  it('retires a stale effect before invoking the configured provider', async () => {
    let providerCallCount = 0;
    let dispatchCallCount = 0;
    const staleProvider: FibWordProvider = {
      generate: () => {
        providerCallCount += 1;
        return provider.generate(createWordRequest());
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

  it('stops after candidate persistence when the round is superseded before finalizing', async () => {
    const dispatchedCommands: FibInternalCommand[] = [];
    const context = createEffectContext((commandId, command) => {
      dispatchedCommands.push(command);
      if (
        command.type === 'fib.round.updatePreparationStage' &&
        command.stage === FIB_PREPARATION_STAGES.finalizing
      ) {
        return Promise.resolve({
          kind: 'rejected',
          commandId,
          reason: REASON_FIB_ROUND_MISMATCH,
        });
      }
      return Promise.resolve(committedResult(commandId));
    });

    await expect(handleFibGenerateWordEffect(EFFECT, context, provider)).resolves.toBeUndefined();

    expect(dispatchedCommands).toEqual([
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.generating,
      },
      {
        type: 'fib.round.updatePreparationStage',
        roundId: 'fib-round:start-command',
        stage: FIB_PREPARATION_STAGES.finalizing,
      },
    ]);
    await expect(
      env.DB.prepare('SELECT word FROM fib_word_generation_results LIMIT 1').first(),
    ).resolves.toEqual({ word: '菡萏' });
    await expect(readRecentFibWords(env.DB, ['host'])).resolves.toEqual([]);
  });

  it('propagates every non-cancellation rejection to the outbox retry policy', async () => {
    const context = createEffectContext((commandId) =>
      Promise.resolve({ kind: 'rejected', commandId, reason: REASON_FIB_WORD_REUSED }),
    );
    await expect(handleFibGenerateWordEffect(EFFECT, context, provider)).rejects.toThrow(
      'was rejected: fib_word_reused',
    );
    await expect(readRecentFibWords(env.DB, ['host'])).resolves.toEqual([]);
  });
});
