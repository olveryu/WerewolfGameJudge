/**
 * gameProcessor unit tests — pure function tests
 *
 * buildHandlerContext 和 extractAudioActions 不依赖 DO/SQLite，
 * 可直接在 Workers 运行时中测试。
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameStatePayload } from '@werewolf/game-engine/protocol/types';
import { describe, expect, it } from 'vitest';

import { buildHandlerContext, extractAudioActions } from '../durableObjects/gameProcessor';

function createMinimalState(overrides?: Partial<GameStatePayload>): GameStatePayload {
  return {
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  };
}

describe('buildHandlerContext', () => {
  it('returns context with mySeat when userId matches a seated player', () => {
    const state = createMinimalState({
      players: {
        0: {
          userId: 'p1',
          seat: 0,
          displayName: 'P1',
          role: null,
          hasViewedRole: false,
        },
        1: null,
        2: null,
      },
    });

    const ctx = buildHandlerContext(state, 'p1');

    expect(ctx.state).toBe(state);
    expect(ctx.myUserId).toBe('p1');
    expect(ctx.mySeat).toBe(0);
  });

  it('returns mySeat null when userId is not seated', () => {
    const state = createMinimalState();

    const ctx = buildHandlerContext(state, 'unknown-uid');

    expect(ctx.myUserId).toBe('unknown-uid');
    expect(ctx.mySeat).toBeNull();
  });

  it('finds correct seat among multiple players', () => {
    const state = createMinimalState({
      players: {
        0: {
          userId: 'p1',
          seat: 0,
          displayName: 'P1',
          role: null,
          hasViewedRole: false,
        },
        1: {
          userId: 'p2',
          seat: 1,
          displayName: 'P2',
          role: null,
          hasViewedRole: false,
        },
        2: null,
      },
    });

    const ctx = buildHandlerContext(state, 'p2');

    expect(ctx.mySeat).toBe(1);
  });
});

describe('extractAudioActions', () => {
  it('returns empty array when no side effects', () => {
    expect(extractAudioActions(undefined)).toEqual([]);
    expect(extractAudioActions([])).toEqual([]);
  });

  it('returns empty array when no PLAY_AUDIO effects', () => {
    const effects = [{ type: 'BROADCAST_STATE' as const }, { type: 'SAVE_STATE' as const }];

    expect(extractAudioActions(effects)).toEqual([]);
  });

  it('extracts PLAY_AUDIO effects into SET_PENDING_AUDIO_EFFECTS + SET_AUDIO_PLAYING', () => {
    const effects = [
      { type: 'PLAY_AUDIO' as const, audioKey: 'wolf_audio' },
      { type: 'BROADCAST_STATE' as const },
      { type: 'PLAY_AUDIO' as const, audioKey: 'seer_audio', isEndAudio: true },
    ];

    const actions = extractAudioActions(effects);

    expect(actions).toHaveLength(2);
    expect(actions[0]).toEqual({
      type: 'SET_PENDING_AUDIO_EFFECTS',
      payload: {
        effects: [
          { audioKey: 'wolf_audio', isEndAudio: undefined },
          { audioKey: 'seer_audio', isEndAudio: true },
        ],
      },
    });
    expect(actions[1]).toEqual({
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying: true },
    });
  });
});
