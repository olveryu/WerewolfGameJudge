/**
 * witchContext.ts 单元测试
 *
 * 测试 computeWitchContext / maybeCreateWitchContextAction 纯函数
 */

import type { BroadcastGameState, BroadcastPlayer } from '@/services/protocol/types';
import { computeWitchContext, maybeCreateWitchContextAction } from '@/services/engine/handlers/witchContext';

// =============================================================================
// Test Helpers
// =============================================================================

function createPlayer(seat: number, role: string): BroadcastPlayer {
  return {
    uid: `uid-${seat}`,
    seatNumber: seat,
    displayName: `Player ${seat}`,
    role: role as BroadcastPlayer['role'],
    hasViewedRole: true,
  };
}

function createOngoingState(
  overrides: Partial<BroadcastGameState> = {},
): NonNullable<BroadcastGameState> {
  return {
    roomCode: '1234',
    hostUid: 'host-uid',
    status: 'ongoing',
    templateRoles: ['wolf', 'witch', 'villager'],
    players: {
      0: createPlayer(0, 'wolf'),
      1: createPlayer(1, 'witch'),
      2: createPlayer(2, 'villager'),
    },
    currentActionerIndex: 0,
    currentStepId: 'wolfKill',
    actions: [],
    currentNightResults: {},
    deaths: [],
    wolfKillDisabled: false,
    isAudioPlaying: false,
    ...overrides,
  } as NonNullable<BroadcastGameState>;
}

// =============================================================================
// computeWitchContext Tests
// =============================================================================

describe('computeWitchContext', () => {
  describe('canSave calculation', () => {
    it('should set canSave=true when wolf kills someone else (normal case)', () => {
      const state = createOngoingState({
        currentNightResults: { wolfVotesBySeat: { '0': 2 } }, // wolf kills villager at seat 2
      });

      const result = computeWitchContext(state);

      expect(result.killedIndex).toBe(2);
      expect(result.canSave).toBe(true);
    });

    it('should set canSave=false when wolf kills the witch (notSelf constraint)', () => {
      const state = createOngoingState({
        currentNightResults: { wolfVotesBySeat: { '0': 1 } }, // wolf kills witch at seat 1
      });

      const result = computeWitchContext(state);

      expect(result.killedIndex).toBe(1);
      expect(result.canSave).toBe(false);
    });

    it('should set canSave=false when no one is killed', () => {
      const state = createOngoingState({
        currentNightResults: {},
      });

      const result = computeWitchContext(state);

      expect(result.killedIndex).toBe(-1);
      expect(result.canSave).toBe(false);
    });

    it('should set canSave=false when wolfKillDisabled', () => {
      const state = createOngoingState({
        wolfKillDisabled: true,
        currentNightResults: { wolfVotesBySeat: { '0': 2 } },
      });

      const result = computeWitchContext(state);

      expect(result.killedIndex).toBe(-1);
      expect(result.canSave).toBe(false);
    });

    /**
     * 边界条件测试：witchSeat === -1
     *
     * 场景：templateRoles 包含 witch，但 players 里没有任何 role === 'witch' 的 seat
     * 期望：canSave 必须为 false（防御性：禁止救人避免异常态误操作）
     */
    it('should set canSave=false when witch seat is not found in players (defensive)', () => {
      // 构造异常状态：templateRoles 有 witch，但 players 里没有 witch
      const state = createOngoingState({
        templateRoles: ['wolf', 'witch', 'villager'],
        players: {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'villager'), // 本应是 witch，但标记为 villager
          2: createPlayer(2, 'villager'),
        },
        currentNightResults: { wolfVotesBySeat: { '0': 2 } }, // wolf kills villager at seat 2
      });

      const result = computeWitchContext(state);

      // 关键断言：即使有被杀者，witchSeat=-1 时 canSave 必须为 false
      expect(result.killedIndex).toBe(2);
      expect(result.canSave).toBe(false);
    });
  });

  describe('canPoison calculation (Night-1 only)', () => {
    it('should always set canPoison=true (Night-1 only project rule)', () => {
      const state = createOngoingState();

      const result = computeWitchContext(state);

      expect(result.canPoison).toBe(true);
    });
  });
});

// =============================================================================
// maybeCreateWitchContextAction Tests
// =============================================================================

describe('maybeCreateWitchContextAction', () => {
  it('should return SET_WITCH_CONTEXT action when entering witchAction step', () => {
    const state = createOngoingState({
      currentNightResults: { wolfVotesBySeat: { '0': 2 } },
    });

    const action = maybeCreateWitchContextAction('witchAction', state);

    expect(action).not.toBeNull();
    expect(action?.type).toBe('SET_WITCH_CONTEXT');
    expect(action?.payload.killedIndex).toBe(2);
    expect(action?.payload.canSave).toBe(true);
  });

  it('should return null when step is not witchAction', () => {
    const state = createOngoingState();

    const action = maybeCreateWitchContextAction('wolfKill', state);

    expect(action).toBeNull();
  });

  it('should return null when witchContext already exists', () => {
    const state = createOngoingState({
      witchContext: { killedIndex: 2, canSave: true, canPoison: true },
    });

    const action = maybeCreateWitchContextAction('witchAction', state);

    expect(action).toBeNull();
  });

  it('should return null when template has no witch', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'villager', 'villager'],
    });

    const action = maybeCreateWitchContextAction('witchAction', state);

    expect(action).toBeNull();
  });
});
