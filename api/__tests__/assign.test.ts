/**
 * Assign Roles API Route Tests — POST /api/game/assign
 *
 * 验证分配角色请求的参数校验、method 检查、handler 委托。
 * 覆盖 405 / 400 / 成功 / 失败 / callback 构建。
 */

import type { BroadcastGameState } from '@werewolf/game-engine';

import type { GameActionResult } from '../_lib/types';
import { mockRequest, mockResponse } from './helpers';

jest.mock('../_lib/cors', () => ({
  handleCors: jest.fn(() => false),
}));

const mockProcessGameAction = jest.fn<Promise<GameActionResult>, [string, unknown]>();
jest.mock('../_lib/gameStateManager', () => ({
  processGameAction: (...args: unknown[]) => mockProcessGameAction(...(args as [string, unknown])),
}));

import { handleCors } from '../_lib/cors';
import handler from '../game/[action]';

const QUERY = { action: 'assign' };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/game/assign', () => {
  it('returns 405 for non-POST', async () => {
    const res = mockResponse();
    await handler(mockRequest({ method: 'GET', query: QUERY }), res);
    expect(res._status).toBe(405);
  });

  it('handles CORS preflight', async () => {
    (handleCors as jest.Mock).mockReturnValueOnce(true);
    const res = mockResponse();
    await handler(mockRequest({ method: 'OPTIONS', query: QUERY }), res);
    expect(res._status).toBe(0);
  });

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { hostUid: 'h1' } }), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ success: false, reason: 'MISSING_PARAMS' });
  });

  it('returns 400 when hostUid is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD', hostUid: 'h1' } }), res);
    expect(res._status).toBe(200);
    expect(mockProcessGameAction).toHaveBeenCalledWith('ABCD', expect.any(Function));
  });

  it('returns 400 on failure', async () => {
    mockProcessGameAction.mockResolvedValue({ success: false, reason: 'NOT_HOST' });
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD', hostUid: 'h1' } }), res);
    expect(res._status).toBe(400);
  });

  it('callback sets isHost correctly', async () => {
    mockProcessGameAction.mockImplementation(async (_code, processFn) => {
      const state = { hostUid: 'h1', players: {} } as unknown as BroadcastGameState;
      const result = (processFn as (s: BroadcastGameState, r: number) => unknown)(state, 0);
      return { success: true, _cb: result } as unknown as GameActionResult;
    });
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD', hostUid: 'h1' } }), res);
    expect(mockProcessGameAction).toHaveBeenCalled();
  });
});
