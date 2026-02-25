/**
 * Update Template API Route Tests — POST /api/game/update-template
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

const QUERY = { action: 'update-template' };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/game/update-template', () => {
  it('returns 405 for non-POST', async () => {
    const res = mockResponse();
    await handler(mockRequest({ method: 'GET', query: QUERY }), res);
    expect(res._status).toBe(405);
  });

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { templateRoles: ['wolf', 'seer'] } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when templateRoles is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
    const res = mockResponse();
    await handler(
      mockRequest({
        query: QUERY,
        body: { roomCode: 'ABCD', templateRoles: ['wolf', 'seer', 'villager'] },
      }),
      res,
    );
    expect(res._status).toBe(200);
  });

  it('returns 400 on failure', async () => {
    mockProcessGameAction.mockResolvedValue({ success: false, reason: 'WRONG_STATUS' });
    const res = mockResponse();
    await handler(
      mockRequest({
        query: QUERY,
        body: { roomCode: 'ABCD', templateRoles: ['wolf'] },
      }),
      res,
    );
    expect(res._status).toBe(400);
  });
});
