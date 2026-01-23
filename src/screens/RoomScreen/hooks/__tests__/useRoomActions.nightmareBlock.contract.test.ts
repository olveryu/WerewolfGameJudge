/**
 * Nightmare Block Contract Tests for useRoomActions
 *
 * NEW BEHAVIOR (Host-authoritative, UI no-interception):
 * - UI does NOT return {type:'blocked'} intent
 * - UI does NOT force skip/empty vote buttons based on blocked status
 * - All actions go through submit → Host validates → ACTION_REJECTED if blocked
 *
 * This test file verifies that the hook layer does NOT intercept blocked players.
 * The blocked behavior is now tested at the resolver layer (resolver tests) and
 * integration layer (integration tests that verify ACTION_REJECTED is broadcast).
 */

import { renderHook } from '@testing-library/react-native';
import { GameStatus } from '../../../../models/Room';
import { getSchema } from '../../../../models/roles/spec';
import type { LocalGameState } from '../../../../services/types/GameStateTypes';
import { useRoomActions, type GameContext, type ActionDeps } from '../useRoomActions';

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
    mySeatNumber: 0,
    myRole: 'seer',
    isAudioPlaying: false,
    isBlockedByNightmare: false,
    wolfKillDisabled: false,
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
// A) Single-target block: UI does NOT intercept
// =============================================================================

describe('A) 单体封锁 - UI 不拦截 (isBlockedByNightmare=true)', () => {
  describe('getActionIntent', () => {
    it('被封锁玩家点击座位 → 返回正常 schema-driven intent (不是 blocked)', () => {
      const ctx = makeContext({
        isBlockedByNightmare: true,
        currentSchema: getSchema('seerCheck'),
        myRole: 'seer',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Tap should return normal reveal intent (Host will reject later)
      const intent = result.current.getActionIntent(1);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('reveal'); // Normal schema-driven intent
      expect(intent?.type).not.toBe('blocked'); // NOT blocked
    });

    it('被封锁的 confirm schema 玩家 (hunter) 点击座位 → 返回 null (confirm 不响应座位点击)', () => {
      const ctx = makeContext({
        isBlockedByNightmare: true,
        currentSchema: getSchema('hunterConfirm'),
        myRole: 'hunter',
        currentActionRole: 'hunter',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Confirm schema returns null for seat taps (action via bottom button only)
      const intent = result.current.getActionIntent(1);
      expect(intent).toBeNull();
    });
  });

  describe('getBottomAction', () => {
    it('被封锁玩家底部按钮 → 正常显示 schema 定义的按钮 (不强制替换)', () => {
      const ctx = makeContext({
        isBlockedByNightmare: true,
        currentSchema: getSchema('seerCheck'),
        myRole: 'seer',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Should show normal skip button from schema (not forced blocked skip)
      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('skip');
      // Label comes from schema.ui.bottomActionText
      expect(bottomAction.buttons[0].label).toBe('不使用技能');
    });

    it('被封锁的 confirm schema 玩家 (hunter) 底部按钮 → 显示 skip 按钮', () => {
      const { BLOCKED_UI_DEFAULTS } = require('../../../../models/roles/spec');
      const ctx = makeContext({
        isBlockedByNightmare: true,
        currentSchema: getSchema('hunterConfirm'),
        myRole: 'hunter',
        currentActionRole: 'hunter',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // When blocked, confirm schema shows skip button instead of confirm
      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('skip');
      expect(bottomAction.buttons[0].label).toBe(BLOCKED_UI_DEFAULTS.skipButtonText);
    });
  });
});

// =============================================================================
// B) Global wolf kill disabled: UI does NOT intercept seat taps
// =============================================================================

describe('B) 全局禁刀 - UI 不拦截座位点击 (wolfKillDisabled=true)', () => {
  describe('getActionIntent', () => {
    it('狼人点击座位 → 返回正常 wolfVote intent (不是 null)', () => {
      const ctx = makeContext({
        wolfKillDisabled: true,
        currentSchema: getSchema('wolfKill'),
        myRole: 'wolf',
        currentActionRole: 'wolf',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Seat tap should return normal wolfVote intent (Host will reject later)
      const intent = result.current.getActionIntent(1);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('wolfVote');
    });

    it('非狼玩家不受 wolfKillDisabled 影响', () => {
      const ctx = makeContext({
        wolfKillDisabled: true,
        currentSchema: getSchema('seerCheck'),
        myRole: 'seer',
        currentActionRole: 'seer',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Seer should still be able to act
      const intent = result.current.getActionIntent(2);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('reveal');
    });
  });

  describe('getBottomAction', () => {
    it('狼人底部按钮 → 正常显示"空刀" (不强制替换文案)', () => {
      const ctx = makeContext({
        wolfKillDisabled: true,
        currentSchema: getSchema('wolfKill'),
        myRole: 'wolf',
        currentActionRole: 'wolf',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      // Should show normal empty vote button (Host will allow empty vote)
      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe('空刀'); // Normal label from schema
      expect(bottomAction.buttons[0].intent.type).toBe('wolfVote');
      expect(bottomAction.buttons[0].intent.targetIndex).toBe(-1); // empty vote
    });

    it('wolfKillDisabled=false 时正常显示"空刀"按钮', () => {
      const ctx = makeContext({
        wolfKillDisabled: false,
        currentSchema: getSchema('wolfKill'),
        myRole: 'wolf',
        currentActionRole: 'wolf',
      });

      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe('空刀');
    });
  });
});

// =============================================================================
// C) Edge case: Both isBlockedByNightmare AND wolfKillDisabled
// =============================================================================

describe('C) Edge case: 梦魇封锁自己 (既是 blocked 又是 wolfKillDisabled)', () => {
  it('UI 不拦截 → getActionIntent 返回正常 wolfVote intent', () => {
    const ctx = makeContext({
      isBlockedByNightmare: true,
      wolfKillDisabled: true,
      currentSchema: getSchema('wolfKill'),
      myRole: 'nightmare',
      currentActionRole: 'wolf',
    });

    const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

    // Should return normal wolfVote intent (Host will reject)
    const intent = result.current.getActionIntent(1);
    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('wolfVote');
    expect(intent?.type).not.toBe('blocked');
  });

  it('getBottomAction 返回正常空刀按钮', () => {
    const ctx = makeContext({
      isBlockedByNightmare: true,
      wolfKillDisabled: true,
      currentSchema: getSchema('wolfKill'),
      myRole: 'nightmare',
      currentActionRole: 'wolf',
    });

    const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

    const bottomAction = result.current.getBottomAction();
    expect(bottomAction.buttons).toHaveLength(1);
    expect(bottomAction.buttons[0].intent.type).toBe('wolfVote');
    expect(bottomAction.buttons[0].intent.targetIndex).toBe(-1);
    expect(bottomAction.buttons[0].label).toBe('空刀');
  });
});

// =============================================================================
// D) No 'blocked' intent type exists
// =============================================================================

describe('D) ActionIntent 类型不包含 blocked', () => {
  it('getActionIntent 永远不返回 type=blocked', () => {
    // Test various blocked scenarios
    const scenarios: Partial<GameContext>[] = [
      { isBlockedByNightmare: true, currentSchema: getSchema('seerCheck'), myRole: 'seer' },
      { isBlockedByNightmare: true, currentSchema: getSchema('guardProtect'), myRole: 'guard' },
      { wolfKillDisabled: true, currentSchema: getSchema('wolfKill'), myRole: 'wolf' },
      {
        isBlockedByNightmare: true,
        wolfKillDisabled: true,
        currentSchema: getSchema('wolfKill'),
        myRole: 'nightmare',
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
