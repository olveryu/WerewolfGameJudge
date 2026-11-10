/**
 * AIChatService.test - streamChatMessage with a mocked fetch: error mapping, cancellation, SSE
 * parsing and the request body (system prompt, game context, history trimming).
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import type { Mock } from 'vitest';

import { API_BASE_URL } from '@/config/api';
import type { ChatMessage, GameContext } from '@/games/werewolf/services/AIChatService';
import { streamChatMessage } from '@/games/werewolf/services/AIChatService';

vi.mock('@/platform/http/client', () => ({
  apiClient: { currentAccessToken: () => 'test-jwt-token' },
}));

type FetchMock = Mock<typeof fetch>;

function stubFetch(implementation: (input: RequestInfo | URL, init?: RequestInit) => unknown) {
  const fetchMock: FetchMock = vi.fn(
    async (input, init) => implementation(input, init) as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** A 200 response whose body reader yields `chunks` (encoded) and then ends. */
function stubStreamingFetch(chunks: readonly string[]) {
  const encoder = new TextEncoder();
  let chunkIndex = 0;
  const reader = {
    read: vi.fn(() => {
      const chunk = chunks[chunkIndex];
      chunkIndex += 1;
      return Promise.resolve(
        chunk === undefined
          ? { done: true, value: undefined }
          : { done: false, value: encoder.encode(chunk) },
      );
    }),
    releaseLock: vi.fn(),
  };
  return stubFetch(() => ({ ok: true, status: 200, body: { getReader: () => reader } }));
}

async function collect(generator: AsyncGenerator<unknown>): Promise<unknown[]> {
  const results: unknown[] = [];
  for await (const chunk of generator) results.push(chunk);
  return results;
}

function sentMessages(fetchMock: FetchMock): Array<{ role: string; content: string }> {
  const body = fetchMock.mock.calls[0]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('Expected a JSON request body');
  const parsed = JSON.parse(body) as { messages: Array<{ role: string; content: string }> };
  return parsed.messages;
}

describe('AIChatService - streamChatMessage', () => {
  const originalAbortSignalAny = AbortSignal.any;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      writable: true,
      value: originalAbortSignalAny,
    });
  });

  it('yields error on network failure', async () => {
    stubFetch(() => {
      throw new TypeError('network error');
    });

    const result = await streamChatMessage([{ role: 'user', content: 'test' }]).next();

    expect(result.value).toEqual({ type: 'error', content: '网络异常，请检查网络后重试' });
  });

  it('re-throws AbortError', async () => {
    const abortErr = new Error('AbortError');
    abortErr.name = 'AbortError';
    stubFetch(() => {
      throw abortErr;
    });

    await expect(streamChatMessage([{ role: 'user', content: 'test' }]).next()).rejects.toThrow(
      'AbortError',
    );
  });

  it('keeps caller cancellation attached while reading the SSE stream', async () => {
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const controller = new AbortController();
    const releaseDetachedRead = new AbortController();
    const abortError = new DOMException('Streaming request cancelled', 'AbortError');
    let notifyStreamReadStarted: (() => void) | null = null;
    const streamReadStarted = new Promise<void>((resolve) => {
      notifyStreamReadStarted = resolve;
    });
    const releaseLock = vi.fn();

    const fetchMock = stubFetch((_input, init) => {
      const signal = init?.signal;
      if (signal === null || signal === undefined) {
        throw new Error('Expected streaming fetch to receive an AbortSignal');
      }
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () =>
              new Promise((_resolve, reject) => {
                if (notifyStreamReadStarted === null) {
                  throw new Error('Expected stream read observer');
                }
                notifyStreamReadStarted();
                signal.addEventListener('abort', () => reject(abortError), { once: true });
                releaseDetachedRead.signal.addEventListener('abort', () => reject(abortError), {
                  once: true,
                });
              }),
            releaseLock,
          }),
        },
      };
    });

    const generator = streamChatMessage(
      [{ role: 'user', content: 'test' }],
      undefined,
      controller.signal,
    );
    const next = generator.next();
    void next.catch(() => undefined);
    await streamReadStarted;
    controller.abort(abortError);

    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    if (requestSignal === null || requestSignal === undefined) {
      throw new Error('Expected the streaming request signal');
    }
    const didRequestAbort = requestSignal.aborted;
    if (!didRequestAbort) releaseDetachedRead.abort();
    expect(didRequestAbort).toBe(true);
    await expect(next).rejects.toMatchObject({ name: 'AbortError' });
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, 'unauthorized', 'AI 服务认证失败，请联系管理员'],
    [429, 'rate limited', '今日 AI 使用次数已达上限，明天再试吧'],
    [500, 'internal error', 'AI 服务暂时不可用，请稍后重试'],
  ])('yields the mapped error on HTTP %i', async (status, body, message) => {
    stubFetch(() => ({ ok: false, status, text: () => Promise.resolve(body) }));

    const result = await streamChatMessage([{ role: 'user', content: 'test' }]).next();

    expect(result.value).toEqual({ type: 'error', content: message });
  });

  it('yields error when response body has no reader', async () => {
    stubFetch(() => ({ ok: true, status: 200, body: null }));

    const result = await streamChatMessage([{ role: 'user', content: 'test' }]).next();

    expect(result.value).toEqual({ type: 'error', content: '浏览器不支持流式响应' });
  });

  it('parses SSE stream and yields deltas', async () => {
    const fetchMock = stubStreamingFetch([
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    const results = await collect(streamChatMessage([{ role: 'user', content: '你好' }]));

    expect(results).toEqual([
      { type: 'delta', content: '你' },
      { type: 'delta', content: '好' },
      { type: 'done', content: '' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/games/werewolf/ai-chat`,
      expect.objectContaining<RequestInit>({ method: 'POST' }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer test-jwt-token',
    });
  });

  it('skips malformed JSON chunks in SSE', async () => {
    stubStreamingFetch([
      'data: {invalid json}\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    const results = await collect(streamChatMessage([{ role: 'user', content: 'test' }]));

    expect(results).toContainEqual({ type: 'delta', content: 'ok' });
    expect(results).toContainEqual({ type: 'done', content: '' });
  });

  it('includes game context in request when provided', async () => {
    const fetchMock = stubStreamingFetch(['data: [DONE]\n\n']);
    const context: GameContext = {
      inRoom: true,
      roomCode: 'ABC1',
      status: GameStatus.Ongoing,
      mySeat: 2,
      myRoleName: '预言家',
      totalPlayers: 9,
    };

    await collect(streamChatMessage([{ role: 'user', content: '我该怎么做？' }], context));

    expect(sentMessages(fetchMock)[0]?.content).toContain('游戏状态');
  });

  it('trims message history when exceeding maxHistoryRounds', async () => {
    const fetchMock = stubStreamingFetch(['data: [DONE]\n\n']);
    // 10 messages (5 rounds) are trimmed to the last 6 (3 rounds)
    const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));

    await collect(streamChatMessage(messages));

    const sent = sentMessages(fetchMock);
    // system + last 6 messages = 7 total
    expect(sent).toHaveLength(7);
    expect(sent[0]?.role).toBe('system');
  });

  it('includes boardRoleDetails in context prompt', async () => {
    const fetchMock = stubStreamingFetch(['data: [DONE]\n\n']);
    const context: GameContext = {
      inRoom: true,
      roomCode: 'ROOM1',
      status: GameStatus.Ongoing,
      mySeat: 0,
      myRoleName: '狼人',
      totalPlayers: 9,
      boardRoleDetails: [
        { name: '狼人', description: '每晚可以杀一名玩家' },
        { name: '预言家', description: '每晚可以查验一名玩家' },
      ],
    };

    await collect(streamChatMessage([{ role: 'user', content: '我的技能是什么？' }], context));

    const systemMessage = sentMessages(fetchMock)[0]?.content;
    expect(systemMessage).toContain('角色配置');
    expect(systemMessage).toContain('狼人');
    expect(systemMessage).toContain('预言家');
    expect(systemMessage).toContain('每晚可以杀一名玩家');
  });

  it('handles context with inRoom=false', async () => {
    const fetchMock = stubStreamingFetch(['data: [DONE]\n\n']);

    await collect(streamChatMessage([{ role: 'user', content: 'test' }], { inRoom: false }));

    expect(sentMessages(fetchMock)[0]?.content).toContain('不在游戏房间中');
  });

  it('yields done when stream ends without [DONE] marker', async () => {
    stubStreamingFetch(['data: {"choices":[{"delta":{"content":"test"}}]}\n\n']);

    const results = await collect(streamChatMessage([{ role: 'user', content: 'test' }]));

    expect(results).toContainEqual({ type: 'delta', content: 'test' });
    expect(results).toContainEqual({ type: 'done', content: '' });
  });
});
