/**
 * Assign Roles API Route Tests — POST /api/game/assign (unique tests)
 *
 * Common tests (405 / 400 / 200 / 400) are in simple-host-endpoints.test.ts.
 * This file tests assign-specific behavior: CORS preflight + callback isHost.
 */

import type { GameState } from '@werewolf/game-engine';

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

describe('POST /api/game/assign (unique)', () => {
  it('handles CORS preflight', async () => {
    (handleCors as jest.Mock).mockReturnValueOnce(true);
    const res = mockResponse();
    await handler(mockRequest({ method: 'OPTIONS', query: QUERY }), res);
    expect(res._status).toBe(0);
  });

  it('returns 400 when params missing (verifies MISSING_PARAMS reason)', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { hostUid: 'h1' } }), res);
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ success: false, reason: 'MISSING_PARAMS' });
  });

  it('callback sets isHost correctly', async () => {
    mockProcessGameAction.mockImplementation(async (_code, processFn) => {
      const state = { hostUid: 'h1', players: {} } as unknown as GameState;
      const result = (processFn as (s: GameState, r: number) => unknown)(state, 0);
      return { success: true, _cb: result } as unknown as GameActionResult;
    });
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD', hostUid: 'h1' } }), res);
    expect(mockProcessGameAction).toHaveBeenCalled();
  });
});
