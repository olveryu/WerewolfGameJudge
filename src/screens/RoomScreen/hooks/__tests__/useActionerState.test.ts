/**
 * useActionerState.test.ts - Unit tests for useActionerState hook
 * 
 * Tests the hook wrapper around determineActionerState.
 */

import { renderHook } from '@testing-library/react-native';
import { useActionerState, UseActionerStateParams } from '../useActionerState';
import type { RoleName } from '../../../../models/roles';
import type { RoleAction } from '../../../../models/actions/RoleAction';

// =============================================================================
// Test Helpers
// =============================================================================

function createParams(overrides: Partial<UseActionerStateParams> = {}): UseActionerStateParams {
  return {
    myRole: null,
    currentActionRole: null,
  currentSchema: null,
    mySeatNumber: null,
    wolfVotes: new Map(),
    isHost: false,
    actions: new Map(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('useActionerState', () => {
  describe('基本行为', () => {
    it('无当前行动角色时 imActioner 应该为 false', () => {
      const { result } = renderHook(() =>
        useActionerState(createParams({ myRole: 'seer' }))
      );

      expect(result.current.imActioner).toBe(false);
      expect(result.current.showWolves).toBe(false);
    });

    it('我是当前行动角色时 imActioner 应该为 true', () => {
      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'seer',
            currentActionRole: 'seer',
            mySeatNumber: 0,
          })
        )
      );

      expect(result.current.imActioner).toBe(true);
    });

    it('我不是当前行动角色时 imActioner 应该为 false', () => {
      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'seer',
            currentActionRole: 'witch',
            mySeatNumber: 0,
          })
        )
      );

      expect(result.current.imActioner).toBe(false);
    });
  });

  describe('狼人投票', () => {
    it('狼人未投票时 imActioner 应该为 true', () => {
      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'wolf',
            currentActionRole: 'wolf',
            currentSchema: require('../../../../models/roles/spec/schemas').getSchema('wolfKill'),
            mySeatNumber: 1,
            wolfVotes: new Map(),
          })
        )
      );

      expect(result.current.imActioner).toBe(true);
      expect(result.current.showWolves).toBe(true);
    });

    it('狼人已投票时 imActioner 应该为 false', () => {
      const wolfVotes = new Map<number, number>();
      wolfVotes.set(1, 0); // seat 1 voted for seat 0

      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'wolf',
            currentActionRole: 'wolf',
            currentSchema: require('../../../../models/roles/spec/schemas').getSchema('wolfKill'),
            mySeatNumber: 1,
            wolfVotes,
          })
        )
      );

      expect(result.current.imActioner).toBe(false);
      expect(result.current.showWolves).toBe(true);
    });

    it('狼队成员在狼人回合时应该看到狼人', () => {
      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'nightmare',
            currentActionRole: 'wolf',
            currentSchema: require('../../../../models/roles/spec/schemas').getSchema('wolfKill'),
            mySeatNumber: 2,
          })
        )
      );

      expect(result.current.showWolves).toBe(true);
    });
  });

  describe('行动提交检测', () => {
    it('非狼人角色已提交行动时 imActioner 应该为 false', () => {
      const actions = new Map<RoleName, RoleAction>();
      actions.set('seer', { type: 'seerCheck', target: 2 } as unknown as RoleAction);

      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'seer',
            currentActionRole: 'seer',
            mySeatNumber: 0,
            actions,
          })
        )
      );

      expect(result.current.imActioner).toBe(false);
    });

    it('非狼人角色未提交行动时 imActioner 应该为 true', () => {
      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'witch',
            currentActionRole: 'witch',
            mySeatNumber: 1,
            actions: new Map(),
          })
        )
      );

      expect(result.current.imActioner).toBe(true);
    });
  });

  describe('梦魇特殊规则', () => {
    it('梦魇自己回合时不应该看到狼人', () => {
      const { result } = renderHook(() =>
        useActionerState(
          createParams({
            myRole: 'nightmare',
            currentActionRole: 'nightmare',
            currentSchema: require('../../../../models/roles/spec/schemas').getSchema('nightmareBlock'),
            mySeatNumber: 0,
          })
        )
      );

      expect(result.current.imActioner).toBe(true);
      expect(result.current.showWolves).toBe(false);
    });
  });

  describe('useMemo 稳定性', () => {
    it('相同输入应该返回相同引用', () => {
      const params = createParams({
        myRole: 'seer',
        currentActionRole: 'seer',
        mySeatNumber: 0,
      });

      const { result, rerender } = renderHook(() => useActionerState(params));
      const firstResult = result.current;

      rerender(undefined);
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });
  });
});
