/**
 * Share Review API Route Tests — POST /api/game/share-review
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

const QUERY = { action: 'share-review' };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/game/share-review', () => {
  it('returns 405 for non-POST', async () => {
    const res = mockResponse();
    await handler(mockRequest({ method: 'GET', query: QUERY }), res);
    expect(res._status).toBe(405);
  });

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { allowedSeats: [0] } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when allowedSeats is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when allowedSeats is not an array', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD', allowedSeats: 0 } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(
      mockRequest({
        query: QUERY,
        body: { roomCode: 'ABCD', allowedSeats: [0, 2] },
      }),
      res,
    );
    expect(res._status).toBe(200);
  });

  it('returns 200 with empty allowedSeats', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(
      mockRequest({
        query: QUERY,
        body: { roomCode: 'ABCD', allowedSeats: [] },
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
        body: { roomCode: 'ABCD', allowedSeats: [0] },
      }),
      res,
    );
    expect(res._status).toBe(400);
  });
});
