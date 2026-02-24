/**
 * Start Night API Route Tests — POST /api/game/start
 *
 * 验证开始夜晚请求的参数校验、method 检查、handler 委托。
 * 特殊逻辑：PLAY_AUDIO sideEffects → SET_PENDING_AUDIO_EFFECTS action。
 * 覆盖 405 / 400 / 成功 / 失败 / audio extraction。
 */

import type { GameState } from '@werewolf/game-engine';
import { GameStatus } from '@werewolf/game-engine';

import type { GameActionResult, ProcessResult } from '../_lib/types';
import { mockRequest, mockResponse } from './helpers';

jest.mock('../_lib/cors', () => ({
  handleCors: jest.fn(() => false),
}));

const mockProcessGameAction = jest.fn<Promise<GameActionResult>, [string, unknown]>();
jest.mock('../_lib/gameStateManager', () => ({
  processGameAction: (...args: unknown[]) => mockProcessGameAction(...(args as [string, unknown])),
}));

import handler from '../game/[action]';

const QUERY = { action: 'start' };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/game/start', () => {
  it('returns 405 for non-POST', async () => {
    const res = mockResponse();
    await handler(mockRequest({ method: 'GET', query: QUERY }), res);
    expect(res._status).toBe(405);
  });

  it('returns 400 when roomCode is missing', async () => {
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { hostUid: 'h1' } }), res);
    expect(res._status).toBe(400);
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
  });

  it('returns 400 on failure', async () => {
    mockProcessGameAction.mockResolvedValue({ success: false, reason: 'NOT_READY' });
    const res = mockResponse();
    await handler(mockRequest({ query: QUERY, body: { roomCode: 'ABCD', hostUid: 'h1' } }), res);
    expect(res._status).toBe(400);
  });

  it('callback appends audio actions when PLAY_AUDIO sideEffects exist', async () => {
    let capturedResult: ProcessResult | undefined;
    mockProcessGameAction.mockImplementation(async (_code, processFn) => {
      const state = {
        hostUid: 'h1',
        status: GameStatus.Ready,
        players: { 1: { uid: 'h1', displayName: 'Host', role: null } },
      } as unknown as GameState;
      capturedResult = (processFn as (s: GameState, r: number) => ProcessResult)(state, 0);
      return { success: true } as GameActionResult;
    });

    // We need handleStartNight to return PLAY_AUDIO sideEffects.
    // Since we're testing the route layer (not game-engine), we mock handleStartNight.
    jest.doMock('@werewolf/game-engine', () => {
      const actual = jest.requireActual('@werewolf/game-engine');
      return {
        ...actual,
        handleStartNight: () => ({
          success: true,
          actions: [{ type: 'SET_STATUS', payload: { status: GameStatus.Ongoing } }],
          sideEffects: [
            { type: 'PLAY_AUDIO', audioKey: 'night-start.mp3' },
            { type: 'PLAY_AUDIO', audioKey: 'wolf-step.mp3', isEndAudio: true },
          ],
        }),
      };
    });

    // Re-import handler with new mock
    jest.resetModules();
    // Re-mock cors and gameStateManager after resetModules
    jest.mock('../_lib/cors', () => ({ handleCors: jest.fn(() => false) }));
    const mockLocalProcess = jest.fn<Promise<GameActionResult>, [string, unknown]>();
    jest.mock('../_lib/gameStateManager', () => ({
      processGameAction: (...args: unknown[]) => mockLocalProcess(...(args as [string, unknown])),
    }));

    mockLocalProcess.mockImplementation(async (_code, processFn) => {
      const state = {
        hostUid: 'h1',
        status: GameStatus.Ready,
        players: { 1: { uid: 'h1', displayName: 'Host', role: null } },
      } as unknown as GameState;
      capturedResult = (processFn as (s: GameState, r: number) => ProcessResult)(state, 0);
      return { success: true } as GameActionResult;
    });

    const freshHandler = (require('../game/[action]') as { default: typeof handler }).default;
    const res = mockResponse();
    await freshHandler(
      mockRequest({ query: QUERY, body: { roomCode: 'ABCD', hostUid: 'h1' } }),
      res,
    );

    expect(capturedResult).toBeDefined();
    expect(capturedResult!.success).toBe(true);

    const actionTypes = capturedResult!.actions.map((a) => a.type);
    expect(actionTypes).toContain('SET_PENDING_AUDIO_EFFECTS');
    expect(actionTypes).toContain('SET_AUDIO_PLAYING');
  });
});
