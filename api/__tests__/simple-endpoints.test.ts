/**
 * Simple Endpoint Tests — DRY consolidated
 *
 * All 5 simple endpoints share identical behavior:
 * extract roomCode → validate → processGameAction → respond.
 * This file tests the common cases for each via describe.each.
 *
 * Unique tests (e.g., assign's CORS preflight) remain in their own file.
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

beforeEach(() => jest.clearAllMocks());

describe.each(['assign', 'clear-seats', 'fill-bots', 'mark-bots-viewed', 'restart'])(
  'POST /api/game/%s',
  (action) => {
    const QUERY = { action };

    it('returns 405 for non-POST', async () => {
      const res = mockResponse();
      await handler(mockRequest({ method: 'GET', query: QUERY }), res);
      expect(res._status).toBe(405);
    });

    it('returns 400 when roomCode is missing', async () => {
      const res = mockResponse();
      await handler(mockRequest({ query: QUERY, body: {} }), res);
      expect(res._status).toBe(400);
    });

    it('returns 200 on success', async () => {
      mockProcessGameAction.mockResolvedValue({ success: true, revision: 1 });
      const res = mockResponse();
      await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD' } }), res);
      expect(res._status).toBe(200);
    });

    it('returns 400 on failure', async () => {
      mockProcessGameAction.mockResolvedValue({ success: false, reason: 'NOT_HOST' });
      const res = mockResponse();
      await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD' } }), res);
      expect(res._status).toBe(400);
    });
  },
);
