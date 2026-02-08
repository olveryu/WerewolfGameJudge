/**
 * Nightmare Block Contract Tests for useRoomActions
 *
 * NEW BEHAVIOR (Host-authoritative, UI no-interception):
 * - UI does NOT know about blocked status (isBlockedByNightmare/wolfKillDisabled removed from GameContext)
 * - UI always returns normal schema-driven intents
 * - All actions go through submit → Host validates → ACTION_REJECTED if blocked
 *
 * This test file verifies that the hook layer returns normal schema-driven intents.
 * The blocked behavior is tested at the resolver layer (resolver tests) and
 * integration layer (integration tests that verify ACTION_REJECTED is broadcast).
 */

import { renderHook } from '@testing-library/react-native';
import { GameStatus } from '@/models/Room';
import { getSchema } from '@/models/roles/spec';
import type { LocalGameState } from '@/services/types/GameStateTypes';
import { useRoomActions, type GameContext, type ActionDeps } from '@/screens/RoomScreen/hooks/useRoomActions';

// =============================================================================
// Test Helpers
// =============================================================================

function makeGameState(): LocalGameState {
  return {
    template: { roles: ['wolf', 'wolf', 'seer'] },
  } as unknown as LocalGameState;
}

function makeContext(overrides: Partial<GameContext> = {}): GameContext {
  return {
    gameState: makeGameState(),
    roomStatus: GameStatus.ongoing,
    currentActionRole: 'seer',
    currentSchema: getSchema('seerCheck'),
    imActioner: true,
    actorSeatNumber: 0,
    actorRole: 'seer',
    isAudioPlaying: false,
    anotherIndex: null,
    ...overrides,
  };
}

const defaultDeps: ActionDeps = {
  hasWolfVoted: () => false,
  getWolfVoteSummary: () => '0/2 狼人已投票',
  getWitchContext: () => null,
};

// =============================================================================
// A) Schema-driven intents: UI returns normal intents for all roles
// =============================================================================

describe('A) Schema-driven intents - UI 总是返回 schema-driven intent', () => {
  describe('getActionIntent', () => {
    it('预言家点击座位 → 返回正常 reveal intent', () => {
      const ctx = makeContext({
        currentSchema: getSchema('seerCheck'),
        actorRole: 'seer',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Tap should return normal reveal intent
      const intent = result.current.getActionIntent(1);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('reveal');
    });

    it('confirm schema 玩家 (hunter) 点击座位 → 返回 null (confirm 不响应座位点击)', () => {
      const ctx = makeContext({
        currentSchema: getSchema('hunterConfirm'),
        actorRole: 'hunter',
        currentActionRole: 'hunter',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Confirm schema returns null for seat taps (action via bottom button only)
      const intent = result.current.getActionIntent(1);
      expect(intent).toBeNull();
    });
  });

  describe('getBottomAction', () => {
    it('预言家底部按钮 → 正常显示 schema 定义的按钮', () => {
      const ctx = makeContext({
        currentSchema: getSchema('seerCheck'),
        actorRole: 'seer',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Should show normal skip button from schema
      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('skip');
      // Label comes from schema.ui.bottomActionText
      expect(bottomAction.buttons[0].label).toBe('不使用技能');
    });

    it('confirm schema 玩家 (hunter) 未被 block 时 → 只显示 confirm 按钮（必须确认）', () => {
      const ctx = makeContext({
        currentSchema: getSchema('hunterConfirm'),
        actorRole: 'hunter',
        currentActionRole: 'hunter',
        // 未被 block（没有设置 blockedSeat）
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Host-authoritative design: 未 blocked 时只显示 confirm，无 skip 选项
      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('confirm');
      expect(bottomAction.buttons[0].label).toBe('查看发动状态');
    });
  });
});

// =============================================================================
// B) Wolf vote: UI returns normal wolfVote intent
// =============================================================================

describe('B) 狼人投票 - UI 返回正常 wolfVote intent', () => {
  describe('getActionIntent', () => {
    it('狼人点击座位 → 返回正常 wolfVote intent', () => {
      const ctx = makeContext({
        currentSchema: getSchema('wolfKill'),
        actorRole: 'wolf',
        currentActionRole: 'wolf',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Seat tap should return normal wolfVote intent
      const intent = result.current.getActionIntent(1);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('wolfVote');
    });
  });

  describe('getBottomAction', () => {
    it('狼人底部按钮 → 正常显示"空刀"按钮', () => {
      const ctx = makeContext({
        currentSchema: getSchema('wolfKill'),
        actorRole: 'wolf',
        currentActionRole: 'wolf',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Should show normal empty vote button
      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe('空刀');
      expect(bottomAction.buttons[0].intent.type).toBe('wolfVote');
      expect(bottomAction.buttons[0].intent.targetIndex).toBe(-1); // empty vote
    });
  });
});

// =============================================================================
// C) Contract: No 'blocked' intent type exists
// =============================================================================

describe('C) 合约: ActionIntent 类型不包含 blocked', () => {
  it('getActionIntent 永远不返回 type=blocked', () => {
    // Test various schema scenarios
    const scenarios: Partial<GameContext>[] = [
      { currentSchema: getSchema('seerCheck'), actorRole: 'seer' },
      { currentSchema: getSchema('guardProtect'), actorRole: 'guard' },
      { currentSchema: getSchema('wolfKill'), actorRole: 'wolf', currentActionRole: 'wolf' },
      {
        currentSchema: getSchema('hunterConfirm'),
        actorRole: 'hunter',
        currentActionRole: 'hunter',
      },
    ];

    for (const overrides of scenarios) {
      const ctx = makeContext(overrides);
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(1);
      // Intent may be null or a valid type, but NEVER 'blocked'
      if (intent) {
        expect(intent.type).not.toBe('blocked');
      }
    }
  });
});

// =============================================================================
// D) Contract: GameContext no longer has isBlockedByNightmare/wolfKillDisabled
// =============================================================================

describe('D) 合约: GameContext 不再包含 block 状态字段', () => {
  it('GameContext 接口不包含 isBlockedByNightmare', () => {
    const ctx = makeContext();
    // This test verifies at compile time that these fields don't exist
    // @ts-expect-error - isBlockedByNightmare does not exist on GameContext
    expect(ctx.isBlockedByNightmare).toBeUndefined();
  });

  it('GameContext 接口不包含 wolfKillDisabled', () => {
    const ctx = makeContext();
    // @ts-expect-error - wolfKillDisabled does not exist on GameContext
    expect(ctx.wolfKillDisabled).toBeUndefined();
  });
});
