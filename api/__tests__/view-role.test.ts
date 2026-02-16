/**
 * View Role API Route Tests — POST /api/game/view-role
 *
 * 验证查看角色请求的参数校验、method 检查、handler 委托。
 *
 * ✅ 覆盖：405 / 400 / 成功 / 失败
 */

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
import handler from '../game/view-role';

beforeEach(() => jest.clearAllMocks());

describe('POST /api/game/view-role', () => {
  it('returns 405 for non-POST', async () => {
    const res = mockResponse();
    await handler(mockRequest({ method: 'GET' }), res);
    expect(res._status).toBe(405);
  });

  it('handles CORS preflight', async () => {
    (handleCors as jest.Mock).mockReturnValueOnce(true);
    const res = mockResponse();
    await handler(mockRequest({ method: 'OPTIONS' }), res);
    expect(res._status).toBe(0);
  });

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ body: { uid: 'u1', seat: 1 } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when uid is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ body: { roomCode: 'ABCD', seat: 1 } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when seat is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ body: { roomCode: 'ABCD', uid: 'u1' } }), res);
    expect(res._status).toBe(400);
  });

  it('accepts seat=0 (not treated as missing)', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ body: { roomCode: 'ABCD', uid: 'u1', seat: 0 } }), res);
    expect(res._status).toBe(200);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(mockRequest({ body: { roomCode: 'ABCD', uid: 'u1', seat: 3 } }), res);
    expect(res._status).toBe(200);
  });

  it('returns 400 on failure', async () => {
    mockProcessGameAction.mockResolvedValue({ success: false, reason: 'WRONG_STATUS' });
    const res = mockResponse();
    await handler(mockRequest({ body: { roomCode: 'ABCD', uid: 'u1', seat: 3 } }), res);
    expect(res._status).toBe(400);
  });
});
