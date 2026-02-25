/**
 * Night Action Catch-All API Route Tests — POST /api/game/night/[action]
 *
 * 验证夜晚子路由分派器的参数校验、method 检查、action 路由、各子 handler 委托。
 * 覆盖：405 / 404 (unknown action) / CORS、action (400 / 200 / failure)、
 * wolf-vote、audio-ack、audio-gate、end、progression、reveal-ack、
 * wolf-robot-viewed 各子路由的 400 / 200 场景。
 */

import type { GameActionResult } from '../_lib/types';
import { mockRequest, mockResponse } from './helpers';

jest.mock('../_lib/cors', () => ({
  handleCors: jest.fn(() => false),
}));

const mockProcessGameAction = jest.fn<Promise<GameActionResult>, [string, unknown, unknown?]>();
jest.mock('../_lib/gameStateManager', () => ({
  processGameAction: (...args: unknown[]) =>
    mockProcessGameAction(...(args as [string, unknown, unknown?])),
}));

import { handleCors } from '../_lib/cors';
import handler from '../game/night/[action]';

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

describe('POST /api/game/night/[action] — Dispatcher', () => {
  it('returns 405 for non-POST', async () => {
    const res = mockResponse();
    await handler(mockRequest({ method: 'GET', query: { action: 'end' } }), res);
    expect(res._status).toBe(405);
  });

  it('handles CORS preflight', async () => {
    (handleCors as jest.Mock).mockReturnValueOnce(true);
    const res = mockResponse();
    await handler(mockRequest({ method: 'OPTIONS', query: { action: 'end' } }), res);
    expect(res._status).toBe(0);
  });

  it('returns 404 for unknown action', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: { action: 'nonexistent' } }), res);
    expect(res._status).toBe(404);
    expect(res._json).toEqual({ success: false, reason: 'UNKNOWN_NIGHT_ACTION' });
  });

  it('returns 404 when action is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: {} }), res);
    expect(res._status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Sub-route: action
// ---------------------------------------------------------------------------

describe('POST /api/game/night/action', () => {
  const query = { action: 'action' };

  it('returns 400 when params missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when seat is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD', role: 'seer' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when role is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD', seat: 1 } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success with inline progression', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(
      mockRequest({
        query,
        body: { roomCode: 'ABCD', seat: 1, role: 'seer', target: 2 },
      }),
      res,
    );
    expect(res._status).toBe(200);
    // Should pass inlineProgression options
    expect(mockProcessGameAction).toHaveBeenCalledWith('ABCD', expect.any(Function), {
      enabled: true,
    });
  });

  it('returns 400 on failure', async () => {
    mockProcessGameAction.mockResolvedValue({ success: false, reason: 'WRONG_STEP' });
    const res = mockResponse();
    await handler(
      mockRequest({
        query,
        body: { roomCode: 'ABCD', seat: 1, role: 'seer', target: 2 },
      }),
      res,
    );
    expect(res._status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Sub-route: wolf-vote
// ---------------------------------------------------------------------------

describe('POST /api/game/night/wolf-vote', () => {
  const query = { action: 'wolf-vote' };

  it('returns 400 when params missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD', voterSeat: 1 } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success with inline progression', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(
      mockRequest({
        query,
        body: { roomCode: 'ABCD', voterSeat: 1, targetSeat: 3 },
      }),
      res,
    );
    expect(res._status).toBe(200);
    expect(mockProcessGameAction).toHaveBeenCalledWith('ABCD', expect.any(Function), {
      enabled: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Sub-route: audio-ack
// ---------------------------------------------------------------------------

describe('POST /api/game/night/audio-ack', () => {
  const query = { action: 'audio-ack' };

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: {} }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Sub-route: audio-gate
// ---------------------------------------------------------------------------

describe('POST /api/game/night/audio-gate', () => {
  const query = { action: 'audio-gate' };

  it('returns 400 when params missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD', isPlaying: true } }), res);
    expect(res._status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Sub-route: end
// ---------------------------------------------------------------------------

describe('POST /api/game/night/end', () => {
  const query = { action: 'end' };

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: {} }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Sub-route: progression
// ---------------------------------------------------------------------------

describe('POST /api/game/night/progression', () => {
  const query = { action: 'progression' };

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: {} }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Sub-route: reveal-ack
// ---------------------------------------------------------------------------

describe('POST /api/game/night/reveal-ack', () => {
  const query = { action: 'reveal-ack' };

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: {} }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Sub-route: wolf-robot-viewed
// ---------------------------------------------------------------------------

describe('POST /api/game/night/wolf-robot-viewed', () => {
  const query = { action: 'wolf-robot-viewed' };

  it('returns 400 when params missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ query, body: { roomCode: 'ABCD', seat: 2 } }), res);
    expect(res._status).toBe(200);
  });
});
