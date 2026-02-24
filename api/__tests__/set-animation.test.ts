/**
 * Set Animation API Route Tests — POST /api/game/set-animation
 *
 * 覆盖 405 / 400 / 成功 / 失败。
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

import handler from '../game/[action]';

const QUERY = { action: 'set-animation' };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/game/set-animation', () => {
  it('returns 405 for non-POST', async () => {
    const res = mockResponse();
    await handler(mockRequest({ method: 'GET', query: QUERY }), res);
    expect(res._status).toBe(405);
  });

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(
      mockRequest({ query: QUERY, body: { hostUid: 'h1', animation: 'roleHunt' } }),
      res,
    );
    expect(res._status).toBe(400);
  });

  it('returns 400 when hostUid is missing', async () => {
    const res = mockResponse();
    await handler(
      mockRequest({ query: QUERY, body: { roomCode: 'ABCD', animation: 'roleHunt' } }),
      res,
    );
    expect(res._status).toBe(400);
  });

  it('returns 400 when animation is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD', hostUid: 'h1' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(
      mockRequest({
        query: QUERY,
        body: { roomCode: 'ABCD', hostUid: 'h1', animation: 'roulette' },
      }),
      res,
    );
    expect(res._status).toBe(200);
  });

  it('returns 400 on failure', async () => {
    mockProcessGameAction.mockResolvedValue({ success: false, reason: 'NOT_HOST' });
    const res = mockResponse();
    await handler(
      mockRequest({
        query: QUERY,
        body: { roomCode: 'ABCD', hostUid: 'h1', animation: 'roleHunt' },
      }),
      res,
    );
    expect(res._status).toBe(400);
  });
});
