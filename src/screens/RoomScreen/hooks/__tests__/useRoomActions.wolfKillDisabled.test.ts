/**
 * Tests for wolfKillDisabled behavior
 *
 * When nightmare blocks a wolf, ALL wolves should only be able to vote empty knife.
 * This is different from isBlockedByNightmare which only affects the blocked player.
 */
import { renderHook } from '@testing-library/react-native';

import { GameStatus } from '../../../../models/Room';
import { getSchema, BLOCKED_UI_DEFAULTS } from '../../../../models/roles/spec';
import type { LocalGameState } from '../../../../services/types/GameStateTypes';
import type { GameContext } from '../../hooks/useRoomActions';
import { useRoomActions } from '../../hooks/useRoomActions';

function makeContext(overrides: Partial<GameContext> = {}): GameContext {
  const base: GameContext = {
    gameState: { template: { roles: [] } } as unknown as LocalGameState,
    roomStatus: GameStatus.ongoing,
    currentActionRole: 'wolf',
    currentSchema: getSchema('wolfKill'),
    imActioner: true,
    mySeatNumber: 0,
    myRole: 'wolf',
    isAudioPlaying: false,
    isBlockedByNightmare: false,
    wolfKillDisabled: false,
    anotherIndex: null,
  };
  return { ...base, ...overrides };
}

const defaultDeps = {
  hasWolfVoted: () => false,
  getWolfVoteSummary: () => '0/2 狼人已投票',
  getWitchContext: () => null,
};

describe('useRoomActions with wolfKillDisabled', () => {
  describe('getActionIntent', () => {
    it('returns wolfVote intent when wolfKillDisabled is false', () => {
      const ctx = makeContext({ wolfKillDisabled: false });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('wolfVote');
      expect(intent?.targetIndex).toBe(3);
    });

    it('returns null when wolfKillDisabled is true (schema-driven block)', () => {
      const ctx = makeContext({ wolfKillDisabled: true });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      // When wolfKillDisabled, deriveIntentFromSchema returns null for wolfVote
      expect(intent).toBeNull();
    });

    it('returns null for non-wolf even when wolfKillDisabled is true', () => {
      const ctx = makeContext({
        wolfKillDisabled: true,
        myRole: 'seer',
        currentSchema: getSchema('wolfKill'),
      });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      expect(intent).toBeNull();
    });
  });

  describe('getBottomAction', () => {
    it('shows normal empty vote button when wolfKillDisabled is false', () => {
      const ctx = makeContext({ wolfKillDisabled: false });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe('空刀');
    });

    it('shows forced empty vote button when wolfKillDisabled is true', () => {
      const ctx = makeContext({ wolfKillDisabled: true });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe(BLOCKED_UI_DEFAULTS.skipButtonText);
      expect(bottomAction.buttons[0].intent.type).toBe('wolfVote');
      expect(bottomAction.buttons[0].intent.targetIndex).toBe(-1);
    });
  });
});
