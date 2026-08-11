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
import { FIB_PREPARATION_TIMEOUT_MS, selectFibWordCategory } from '../../wordGenerationResults';
import { readRecentFibWords, recordFibWordExposure } from '../../wordHistory';
import { createConfiguredFibWordProvider } from '..';
import {
  FIB_WORD_CANDIDATES_JSON_SCHEMA,
  FIB_WORD_JSON_SCHEMA,
  parseFibWordCandidate,
  selectGeneratedFibWordCandidate,
} from '../candidate';
import { createGeminiFibWordProvider } from '../gemini';
import { createLocalFibWordProvider } from '../local';
import { LOCAL_FIB_WORD_BANK } from '../localWordBank';
import { FibWordProviderError } from '../providerError';
import type { FibWordProvider, FibWordRequest } from '../types';

const ROOM_ID = 'fib-provider-room';
const ROOM_CODE = '9876';
const CREATION_ID = 'fib-provider-creation';
const TEST_GENERATION_BUDGET_MS = 60_000;

const EFFECT = {
  type: 'fib.word.generate',
  payload: { roundId: 'fib-round:start-command', avoidWords: [] },
} as const;

const AI_DEFINITION = {
  coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
  usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
} as const;

const FAN_DEFINITION = {
  coreMeaning: '古代婚礼中移去新娘遮面扇子的一种礼俗。',
  usageNote: '多用于描述传统婚礼仪节，不是泛指把普通扇子收起来。',
} as const;

const GUESSING_DEFINITION = {
  coreMeaning: '把物品遮盖起来，再让参与者猜测所藏物品的游戏。',
  usageNote: '源于古代宴饮和文人游戏语境，不是现代射击活动的名称。',
} as const;

const MIST_DEFINITION = {
  coreMeaning: '烟气或云雾在空气中弥漫缭绕的朦胧景象。',
  usageNote: '常用于描写云烟、水汽或光线交织形成的柔和氛围。',
} as const;

const AI_CANDIDATE = {
  word: '菡萏',
  definition: AI_DEFINITION,
  category: 'literary',
  evidence: `菡萏：${AI_DEFINITION.coreMeaning}`,
} as const;

const AI_CANDIDATES_RESPONSE = {
  candidates: [
    AI_CANDIDATE,
    {
      ...AI_CANDIDATE,
      word: '却扇',
      definition: FAN_DEFINITION,
      evidence: `却扇：${FAN_DEFINITION.coreMeaning}`,
    },
    {
      ...AI_CANDIDATE,
      word: '射覆',
      definition: GUESSING_DEFINITION,
      evidence: `射覆：${GUESSING_DEFINITION.coreMeaning}`,
    },
  ],
} as const;

function createGroundedGeminiResponse(
  annotations: readonly Record<string, unknown>[] | null = null,
): Record<string, unknown> {
  const text = JSON.stringify(AI_CANDIDATES_RESPONSE);
  const groundedAnnotations = AI_CANDIDATES_RESPONSE.candidates.map((candidate, index) => {
    const startIndex = text.indexOf(candidate.evidence);
    if (startIndex < 0)
      throw new Error(`Missing evidence in grounded test response: ${candidate.word}`);
    return {
      type: 'url_citation',
      url: `https://example.com/source-${index + 1}`,
      title: `source-${index + 1}`,
      start_index: startIndex,
      end_index: startIndex + candidate.evidence.length,
    };
  });
  return {
    id: 'interaction-test',
    status: 'completed',
    steps: [
      { type: 'google_search_call', arguments: { queries: ['菡萏', '却扇', '射覆'] } },
      { type: 'google_search_result', call_id: 'search-test', result: [] },
      {
        type: 'model_output',
        content: [
          {
            type: 'text',
            text,
            annotations: annotations ?? groundedAnnotations,
          },
        ],
      },
    ],
  };
}

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
  it('selects first-round categories stably without fixing every room to literary', async () => {
    const selectionSeeds = Array.from({ length: 32 }, (_, index) => `fib-round:${index}`);
    const categories = await Promise.all(selectionSeeds.map(selectFibWordCategory));

    await expect(selectFibWordCategory(selectionSeeds[0])).resolves.toBe(categories[0]);
    expect(new Set(categories)).toEqual(new Set(['literary', 'internet', 'compound', 'niche']));
    await expect(selectFibWordCategory('')).rejects.toThrow('selection seed must be non-empty');
  });

  it('rejects an unknown deployment provider at the composition boundary', () => {
    expect(() =>
      createConfiguredFibWordProvider({ ...env, FIB_WORD_PROVIDER: 'invented-provider' }),
    ).toThrow('Unknown FIB_WORD_PROVIDER: invented-provider');
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

  it('validates every AI candidate against the server-selected category', () => {
    expect(() =>
      selectGeneratedFibWordCandidate(
        {
          candidates: [
            AI_CANDIDATE,
            { ...AI_CANDIDATE, word: '却扇', category: 'internet' },
            { ...AI_CANDIDATE, word: '射覆' },
          ],
        },
        'gemini',
        AI_WORD_REQUEST,
      ),
    ).toThrow('expected literary');
    expect(() =>
      selectGeneratedFibWordCandidate(
        { candidates: AI_CANDIDATES_RESPONSE.candidates.slice(0, 2) },
        'gemini',
        AI_WORD_REQUEST,
      ),
    ).toThrow();
  });

  it('selects the highest-ranked eligible AI candidate from one generated response', () => {
    expect(
      selectGeneratedFibWordCandidate(
        AI_CANDIDATES_RESPONSE,
        'gemini',
        createWordRequest({ recentWords: ['菡萏'] }),
      ),
    ).toEqual({
      word: '却扇',
      definition: FAN_DEFINITION,
      source: 'gemini',
    });
    expect(() =>
      selectGeneratedFibWordCandidate(
        {
          candidates: [
            AI_CANDIDATE,
            { ...AI_CANDIDATE, word: '却扇' },
            { ...AI_CANDIDATE, word: '却扇' },
          ],
        },
        'gemini',
        createWordRequest(),
      ),
    ).toThrow('returned duplicate candidate');
    expect(FIB_WORD_CANDIDATES_JSON_SCHEMA.properties.candidates).toMatchObject({
      items: FIB_WORD_JSON_SCHEMA,
    });
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

  it('uses one grounded Gemini interaction and accepts independently cited candidates', async () => {
    let fetchCallCount = 0;
    let requestUrl = '';
    let requestBody = '';
    let requestApiKey: string | null = null;
    let requestSignal: AbortSignal | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      fetchCallCount += 1;
      requestUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (typeof init?.body !== 'string') {
        throw new Error('Expected Gemini request body to be a JSON string');
      }
      requestBody = init.body;
      requestApiKey = new Headers(init.headers).get('x-goog-api-key');
      requestSignal = init.signal ?? null;
      return Response.json(createGroundedGeminiResponse());
    };
    const provider = createGeminiFibWordProvider('test-key', fetchImpl);

    await expect(provider.generate(AI_WORD_REQUEST)).resolves.toEqual({
      word: '菡萏',
      definition: AI_DEFINITION,
      source: 'gemini',
    });
    expect(requestUrl).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(requestApiKey).toBe('test-key');
    expect(requestBody).toContain('"tools":[{"type":"google_search"}]');
    expect(requestBody).toContain('"mime_type":"application/json"');
    expect(requestBody).toContain('"additionalProperties":false');
    expect(requestBody).toContain('"model":"gemini-3.5-flash-lite"');
    expect(requestBody).toContain('"store":false');
    expect(requestBody).toContain('一次返回恰好3个互不重复的候选');
    expect(requestBody).toContain('按出题质量从高到低排列');
    expect(requestBody).toContain('至少三种彼此不同且看似合理的假释义');
    expect(requestBody).toContain('真实含义具体、出人意料');
    expect(requestBody).toContain('禁止常见成语、日常高频词');
    expect(requestBody).toContain('多数玩家读不出的生僻字堆');
    expect(requestBody).toContain('逐字解释就能猜中的透明复合词');
    expect(requestBody).toContain('必须为每个候选分别调用谷歌搜索');
    expect(requestBody).toContain('必须逐字等于该候选的 word');
    expect(requestBody).toContain('三个 evidence 必须分别获得该候选自己的搜索引用');
    expect(requestBody).toContain('"candidates"');
    expect(requestBody).toContain('"evidence"');
    expect(fetchCallCount).toBe(1);
    expect(requestSignal).toBe(AI_WORD_REQUEST.signal);

    const failingFetch: typeof fetch = async () => new Response('unavailable', { status: 503 });
    await expect(
      createGeminiFibWordProvider('test-key', failingFetch).generate(createWordRequest()),
    ).rejects.toMatchObject({
      failureKind: 'serviceUnavailable',
      message: 'Gemini Fib word request failed (503): unavailable',
    });
  });

  it('accepts citations limited to each candidate core meaning', async () => {
    const text = JSON.stringify(AI_CANDIDATES_RESPONSE);
    const meaningCitations = AI_CANDIDATES_RESPONSE.candidates.map((candidate, index) => {
      const evidenceStart = text.indexOf(candidate.evidence);
      const meaningStart = evidenceStart + candidate.word.length + 1;
      return {
        type: 'url_citation',
        url: `https://example.com/meaning-source-${index + 1}`,
        title: `meaning-source-${index + 1}`,
        start_index: meaningStart,
        end_index: meaningStart + candidate.definition.coreMeaning.length,
      };
    });
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(Response.json(createGroundedGeminiResponse(meaningCitations)));

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generate(createWordRequest()),
    ).resolves.toMatchObject({ word: '菡萏', source: 'gemini' });
  });

  it('rejects Gemini candidates without independent valid citations', async () => {
    const text = JSON.stringify(AI_CANDIDATES_RESPONSE);
    const firstEvidence = AI_CANDIDATES_RESPONSE.candidates[0].evidence;
    const firstEvidenceStart = text.indexOf(firstEvidence);
    const onlyFirstCandidateCitation = [
      {
        type: 'url_citation',
        url: 'https://example.com/only-first-candidate',
        title: 'only-first-candidate',
        start_index: firstEvidenceStart,
        end_index: firstEvidenceStart + firstEvidence.length,
      },
    ];
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(Response.json(createGroundedGeminiResponse(onlyFirstCandidateCitation)));

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generate(createWordRequest()),
    ).rejects.toMatchObject({ failureKind: 'invalidOutput' });

    const outOfBoundsCitation = [
      {
        ...onlyFirstCandidateCitation[0],
        end_index: text.length + 1,
      },
    ];
    const invalidRangeFetch: typeof fetch = () =>
      Promise.resolve(Response.json(createGroundedGeminiResponse(outOfBoundsCitation)));
    await expect(
      createGeminiFibWordProvider('test-key', invalidRangeFetch).generate(createWordRequest()),
    ).rejects.toMatchObject({ failureKind: 'invalidOutput' });

    const thirdEvidence = AI_CANDIDATES_RESPONSE.candidates[2].evidence;
    const thirdEvidenceStart = text.indexOf(thirdEvidence);
    const wrongCandidateCitations = [
      onlyFirstCandidateCitation[0],
      { ...onlyFirstCandidateCitation[0], url: 'https://example.com/wrong-second-candidate' },
      {
        ...onlyFirstCandidateCitation[0],
        url: 'https://example.com/third-candidate',
        start_index: thirdEvidenceStart,
        end_index: thirdEvidenceStart + thirdEvidence.length,
      },
    ];
    const wrongCandidateFetch: typeof fetch = () =>
      Promise.resolve(Response.json(createGroundedGeminiResponse(wrongCandidateCitations)));
    await expect(
      createGeminiFibWordProvider('test-key', wrongCandidateFetch).generate(createWordRequest()),
    ).rejects.toMatchObject({ failureKind: 'invalidOutput' });

    const secondEvidence = AI_CANDIDATES_RESPONSE.candidates[1].evidence;
    const secondEvidenceStart = text.indexOf(secondEvidence);
    const crossCandidateCitations = [
      {
        ...onlyFirstCandidateCitation[0],
        url: 'https://example.com/cross-candidate',
        end_index: secondEvidenceStart + secondEvidence.length,
      },
      wrongCandidateCitations[2],
    ];
    const crossCandidateFetch: typeof fetch = () =>
      Promise.resolve(Response.json(createGroundedGeminiResponse(crossCandidateCitations)));
    await expect(
      createGeminiFibWordProvider('test-key', crossCandidateFetch).generate(createWordRequest()),
    ).rejects.toMatchObject({ failureKind: 'invalidOutput' });
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
