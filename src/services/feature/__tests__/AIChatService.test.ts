/**
 * AIChatService.test - Unit tests for AI Chat Service
 *
 * Tests the pure functions (isAIChatReady, buildGameContextPrompt)
 * and the streamChatMessage async generator with mocked fetch.
 */

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  log: { extend: () => ({ debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) },
}));

// Variable to control supabase config
let mockConfigured = true;
jest.mock('@/config/supabase', () => ({
  get isSupabaseConfigured() {
    return () => mockConfigured;
  },
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
}));

import type { GameContext } from '@/services/feature/AIChatService';
import { isAIChatReady, streamChatMessage } from '@/services/feature/AIChatService';

describe('AIChatService - isAIChatReady', () => {
  it('returns true when supabase is configured', () => {
    mockConfigured = true;
    expect(isAIChatReady()).toBe(true);
  });

  it('returns false when supabase is not configured', () => {
    mockConfigured = false;
    expect(isAIChatReady()).toBe(false);
  });
});

describe('AIChatService - streamChatMessage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockConfigured = true;
  });

  it('yields error when AI service not configured', async () => {
    mockConfigured = false;
    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({ type: 'error', content: 'AI 服务未配置' });
    expect((await gen.next()).done).toBe(true);
  });

  it('yields error on network failure', async () => {
    mockConfigured = true;
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network error'));

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({
      type: 'error',
      content: '网络请求失败，请检查网络后重试',
    });
  });

  it('re-throws AbortError', async () => {
    mockConfigured = true;
    const abortErr = new Error('AbortError');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    await expect(gen.next()).rejects.toThrow('AbortError');
  });

  it('yields error on HTTP 401', async () => {
    mockConfigured = true;
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
    mockConfigured = true;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limited'),
    });

    const gen = streamChatMessage([{ role: 'user', content: 'test' }]);
    const result = await gen.next();

    expect(result.value).toEqual({ type: 'error', content: '请求太频繁，请稍后再试' });
  });

  it('yields error on HTTP 500', async () => {
    mockConfigured = true;
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
    mockConfigured = true;
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
    mockConfigured = true;
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
  });

  it('skips malformed JSON chunks in SSE', async () => {
    mockConfigured = true;
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
    mockConfigured = true;
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
      status: 'ongoing',
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
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('游戏状态'),
      }),
    );
  });

  it('trims message history when exceeding maxHistoryRounds', async () => {
    mockConfigured = true;
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
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
    }));

    const gen = streamChatMessage(messages);
    for await (const _chunk of gen) {
      // consume stream
    }

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    // system + last 6 messages = 7 total
    expect(body.messages).toHaveLength(7);
    expect(body.messages[0].role).toBe('system');
  });

  it('includes boardRoleDetails in context prompt', async () => {
    mockConfigured = true;
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
      status: 'ongoing',
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

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const systemMsg = body.messages[0].content;
    expect(systemMsg).toContain('板子配置');
    expect(systemMsg).toContain('狼人');
    expect(systemMsg).toContain('预言家');
    expect(systemMsg).toContain('每晚可以杀一名玩家');
  });

  it('handles context with inRoom=false', async () => {
    mockConfigured = true;
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

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('不在游戏房间中');
  });

  it('yields done when stream ends without [DONE] marker', async () => {
    mockConfigured = true;
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
