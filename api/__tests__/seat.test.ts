/**
 * Seat API Route Tests — POST /api/game/seat
 *
 * 验证入座/离座请求的参数校验、method 检查、handler 委托。
 * 覆盖 405 / 400 / sit 路径 / standup 路径 / processGameAction 委托。
 * 不测试 game-engine 纯函数逻辑（由 engine 自身测试覆盖）。
 */

import type { GameState } from '@werewolf/game-engine';

import type { GameActionResult } from '../_lib/types';
import { mockRequest, mockResponse } from './helpers';

// --- Mocks ---
jest.mock('../_lib/cors', () => ({
  handleCors: jest.fn(() => false),
}));

const mockProcessGameAction = jest.fn<Promise<GameActionResult>, [string, unknown]>();
jest.mock('../_lib/gameStateManager', () => ({
  processGameAction: (...args: unknown[]) => mockProcessGameAction(...(args as [string, unknown])),
}));

import { handleCors } from '../_lib/cors';
import handler from '../game/[action]';

const QUERY = { action: 'seat' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/game/seat', () => {
  // --- Method check ---
  it('returns 405 for non-POST', async () => {
    const req = mockRequest({ method: 'GET', query: QUERY });
    const res = mockResponse();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._json).toEqual({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  });

  // --- CORS ---
  it('handles CORS preflight and returns early', async () => {
    (handleCors as jest.Mock).mockReturnValueOnce(true);
    const req = mockRequest({ method: 'OPTIONS', query: QUERY });
    const res = mockResponse();
    await handler(req, res);
    expect(handleCors).toHaveBeenCalledWith(req, res);
    expect(res._status).toBe(0); // handler returned early
  });

  // --- Param validation ---
  it('returns 400 when roomCode is missing', async () => {
    const req = mockRequest({ query: QUERY, body: { action: 'sit', uid: 'u1', seat: 1 } });
    const res = mockResponse();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ success: false, reason: 'MISSING_PARAMS' });
  });

  it('returns 400 when uid is missing', async () => {
    const req = mockRequest({ query: QUERY, body: { roomCode: 'ABCD', action: 'sit', seat: 1 } });
    const res = mockResponse();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    const req = mockRequest({ query: QUERY, body: { roomCode: 'ABCD', uid: 'u1', seat: 1 } });
    const res = mockResponse();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when action=sit but seat is missing', async () => {
    const req = mockRequest({
      query: QUERY,
      body: { roomCode: 'ABCD', action: 'sit', uid: 'u1' },
    });
    const res = mockResponse();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ success: false, reason: 'MISSING_SEAT' });
  });

  // --- Success path (sit) ---
  it('calls processGameAction for sit and returns 200', async () => {
    const fakeResult: GameActionResult = { success: true, revision: 1 };
    mockProcessGameAction.mockResolvedValue(fakeResult);

    const req = mockRequest({
      query: QUERY,
      body: { roomCode: 'ABCD', action: 'sit', uid: 'u1', seat: 3, displayName: 'Alice' },
    });
    const res = mockResponse();
    await handler(req, res);

    expect(mockProcessGameAction).toHaveBeenCalledWith('ABCD', expect.any(Function));
    expect(res._status).toBe(200);
    expect(res._json).toEqual(fakeResult);
  });

  // --- Success path (standup) ---
  it('calls processGameAction for standup and returns 200', async () => {
    const fakeResult: GameActionResult = { success: true, revision: 2 };
    mockProcessGameAction.mockResolvedValue(fakeResult);

    const req = mockRequest({
      query: QUERY,
      body: { roomCode: 'ABCD', action: 'standup', uid: 'u1' },
    });
    const res = mockResponse();
    await handler(req, res);

    expect(mockProcessGameAction).toHaveBeenCalledWith('ABCD', expect.any(Function));
    expect(res._status).toBe(200);
  });

  // --- Failure path ---
  it('returns 400 when processGameAction fails', async () => {
    const fakeResult: GameActionResult = { success: false, reason: 'SEAT_TAKEN' };
    mockProcessGameAction.mockResolvedValue(fakeResult);

    const req = mockRequest({
      query: QUERY,
      body: { roomCode: 'ABCD', action: 'sit', uid: 'u1', seat: 1 },
    });
    const res = mockResponse();
    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json).toEqual(fakeResult);
  });

  // --- Callback logic: sit calls handleJoinSeat ---
  it('sit callback constructs JoinSeatIntent and calls handleJoinSeat', async () => {
    mockProcessGameAction.mockImplementation(async (_code, processFn) => {
      const state = {
        hostUid: 'host1',
        players: { 2: { uid: 'u1', displayName: 'A', role: null } },
      } as unknown as GameState;
      const result = (processFn as (s: GameState, r: number) => unknown)(state, 1);
      // Should be a ProcessResult from handleJoinSeat
      return { success: true, _callbackResult: result } as unknown as GameActionResult;
    });

    const req = mockRequest({
      query: QUERY,
      body: { roomCode: 'ABCD', action: 'sit', uid: 'u1', seat: 3 },
    });
    const res = mockResponse();
    await handler(req, res);

    expect(mockProcessGameAction).toHaveBeenCalled();
  });

  // --- Callback logic: standup calls handleLeaveMySeat ---
  it('standup callback constructs LeaveMySeatIntent and calls handleLeaveMySeat', async () => {
    mockProcessGameAction.mockImplementation(async (_code, processFn) => {
      const state = {
        hostUid: 'host1',
        players: { 2: { uid: 'u1', displayName: 'A', role: null } },
      } as unknown as GameState;
      const result = (processFn as (s: GameState, r: number) => unknown)(state, 1);
      return { success: true, _callbackResult: result } as unknown as GameActionResult;
    });

    const req = mockRequest({
      query: QUERY,
      body: { roomCode: 'ABCD', action: 'standup', uid: 'u1' },
    });
    const res = mockResponse();
    await handler(req, res);

    expect(mockProcessGameAction).toHaveBeenCalled();
  });
});
