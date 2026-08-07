/**
 * AIChatService.test - Unit tests for AI Chat Service
 *
 * Tests the pure functions (isAIChatReady, buildGameContextPrompt)
 * and the streamChatMessage async generator with mocked fetch.
 */

// Mock logger
jest.mock('@/utils/logger', () => ({
  log: { extend: () => ({ debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) },
}));

// Mock api config
jest.mock('@/config/api', () => ({
  API_BASE_URL: 'https://test-api.workers.dev',
}));

// Mock cfFetch token provider
jest.mock('@/services/cloudflare/cfFetch', () => ({
  getCurrentToken: () => 'test-jwt-token',
}));

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { ChatMessage, GameContext } from '@/games/werewolf/services/AIChatService';
import { isAIChatReady, streamChatMessage } from '@/games/werewolf/services/AIChatService';

describe('AIChatService - isAIChatReady', () => {
  it('returns true', () => {
    expect(isAIChatReady()).toBe(true);
  });
});

describe('AIChatService - streamChatMessage', () => {
  const originalFetch = global.fetch;
  const originalAbortSignalAny = AbortSignal.any;

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      writable: true,
      value: originalAbortSignalAny,
    });
  });

  it('yields error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network error'));

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({
      type: 'error',
      content: '网络异常，请检查网络后重试',
    });
  });

  it('re-throws AbortError', async () => {
    const abortErr = new Error('AbortError');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    await expect(gen.next()).rejects.toThrow('AbortError');
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
    const releaseLock = jest.fn();

    global.fetch = jest.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal === null || signal === undefined) {
        throw new Error('Expected streaming fetch to receive an AbortSignal');
      }
      return Promise.resolve({
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
      });
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

    const requestSignal = jest.mocked(global.fetch).mock.calls[0]?.[1]?.signal;
    if (requestSignal === null || requestSignal === undefined) {
      throw new Error('Expected the streaming request signal');
    }
    const didRequestAbort = requestSignal.aborted;
    if (!didRequestAbort) releaseDetachedRead.abort();
    expect(didRequestAbort).toBe(true);
    await expect(next).rejects.toMatchObject({ name: 'AbortError' });
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it('yields error on HTTP 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('unauthorized'),
    });

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({ type: 'error', content: 'AI 服务认证失败，请联系管理员' });
  });

  it('yields error on HTTP 429', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limited'),
    });

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({
      type: 'error',
      content: '今日 AI 使用次数已达上限，明天再试吧',
    });
  });

  it('yields error on HTTP 500', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('internal error'),
    });

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({ type: 'error', content: 'AI 服务暂时不可用，请稍后重试' });
  });

  it('yields error when response body has no reader', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    });

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({ type: 'error', content: '浏览器不支持流式响应' });
  });

  it('parses SSE stream and yields deltas', async () => {
    const encoder = new TextEncoder();

    const chunks = [
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: jest.fn().mockImplementation(() => {
        if (chunkIndex < chunks.length) {
          return Promise.resolve({ done: false, value: encoder.encode(chunks[chunkIndex++]) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      releaseLock: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });

    const gen = streamChatMessage([{ role: 'user', content: '你好' }]);
    const results = [];
    for await (const chunk of gen) {
      results.push(chunk);
    }

    expect(results).toEqual([
      { type: 'delta', content: '你' },
      { type: 'delta', content: '好' },
      { type: 'done', content: '' },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-api.workers.dev/api/games/werewolf/ai-chat',
      expect.objectContaining<RequestInit>({ method: 'POST' }),
    );
  });

  it('skips malformed JSON chunks in SSE', async () => {
    const encoder = new TextEncoder();

    const chunks = [
      'data: {invalid json}\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: jest.fn().mockImplementation(() => {
        if (chunkIndex < chunks.length) {
          return Promise.resolve({ done: false, value: encoder.encode(chunks[chunkIndex++]) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      releaseLock: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const results = [];
    for await (const chunk of gen) {
      results.push(chunk);
    }

    // Should skip the invalid JSON and still get the valid one
    expect(results).toContainEqual({ type: 'delta', content: 'ok' });
    expect(results).toContainEqual({ type: 'done', content: '' });
  });

  it('includes game context in request when provided', async () => {
    const encoder = new TextEncoder();

    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('data: [DONE]\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });

    const context: GameContext = {
      inRoom: true,
      roomCode: 'ABC1',
      status: GameStatus.Ongoing,
      mySeat: 2,
      myRoleName: '预言家',
      totalPlayers: 9,
    };

    const gen = streamChatMessage([{ role: 'user', content: '我该怎么做？' }], context);
    for await (const _chunk of gen) {
      // consume
    }

    // Verify fetch was called with system prompt containing context
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining<RequestInit>({
        method: 'POST',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        body: expect.stringContaining('游戏状态'),
      }),
    );
  });

  it('trims message history when exceeding maxHistoryRounds', async () => {
    const encoder = new TextEncoder();
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('data: [DONE]\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });

    // Create 10 messages (5 rounds) — should be trimmed to last 6 (3 rounds)
    const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));

    const gen = streamChatMessage(messages);
    for await (const _chunk of gen) {
      // consume stream
    }

    const body = JSON.parse(jest.mocked(global.fetch).mock.calls[0]![1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    // system + last 6 messages = 7 total
    expect(body.messages).toHaveLength(7);
    expect(body.messages[0]!.role).toBe('system');
  });

  it('includes boardRoleDetails in context prompt', async () => {
    const encoder = new TextEncoder();
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('data: [DONE]\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });

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

    const gen = streamChatMessage([{ role: 'user', content: '我的技能是什么？' }], context);
    for await (const _chunk of gen) {
      // consume stream
    }

    const body = JSON.parse(jest.mocked(global.fetch).mock.calls[0]![1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMsg = body.messages[0]!.content;
    expect(systemMsg).toContain('角色配置');
    expect(systemMsg).toContain('狼人');
    expect(systemMsg).toContain('预言家');
    expect(systemMsg).toContain('每晚可以杀一名玩家');
  });

  it('handles context with inRoom=false', async () => {
    const encoder = new TextEncoder();
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('data: [DONE]\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });

    const context: GameContext = { inRoom: false };
    const gen = streamChatMessage([{ role: 'user', content: 'test' }], context);
    for await (const _chunk of gen) {
      // consume stream
    }

    const body = JSON.parse(jest.mocked(global.fetch).mock.calls[0]![1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[0]!.content).toContain('不在游戏房间中');
  });

  it('yields done when stream ends without [DONE] marker', async () => {
    const encoder = new TextEncoder();
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('data: {"choices":[{"delta":{"content":"test"}}]}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const results = [];
    for await (const chunk of gen) {
      results.push(chunk);
    }

    expect(results).toContainEqual({ type: 'delta', content: 'test' });
    expect(results).toContainEqual({ type: 'done', content: '' });
  });
});
