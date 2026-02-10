/**
 * Tests for wolf vote behavior (Host-authoritative version)
 *
 * NEW BEHAVIOR:
 * - UI no longer knows about wolfKillDisabled (removed from GameContext)
 * - Wolf can tap seats and get normal intent
 * - Host validates and rejects via ACTION_REJECTED if needed
 * - UI shows normal buttons
 *
 * This test now verifies normal wolf vote behavior without block-related fields.
 */
import { renderHook } from '@testing-library/react-native';

import { GameStatus } from '@/models/GameStatus';
import { getSchema } from '@/models/roles/spec';
import type { GameContext } from '@/screens/RoomScreen/hooks/useRoomActions';
import { useRoomActions } from '@/screens/RoomScreen/hooks/useRoomActions';
import type { LocalGameState } from '@/types/GameStateTypes';

function makeContext(overrides: Partial<GameContext> = {}): GameContext {
  const base: GameContext = {
    gameState: { template: { roles: [] } } as unknown as LocalGameState,
    roomStatus: GameStatus.ongoing,
    currentActionRole: 'wolf',
    currentSchema: getSchema('wolfKill'),
    imActioner: true,
    actorSeatNumber: 0,
    actorRole: 'wolf',
    isAudioPlaying: false,
    anotherIndex: null,
  };
  return { ...base, ...overrides };
}

const defaultDeps = {
  hasWolfVoted: () => false,
  getWolfVoteSummary: () => '0/2 狼人已投票',
  getWitchContext: () => null,
};

describe('useRoomActions wolf vote (Host-authoritative)', () => {
  describe('getActionIntent', () => {
    it('returns wolfVote intent for wolf actioner', () => {
      const ctx = makeContext();
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('wolfVote');
      expect(intent?.targetIndex).toBe(3);
    });

    it('returns null for non-wolf (not their turn)', () => {
      const ctx = makeContext({
        actorRole: 'seer',
        imActioner: false,
      });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      expect(intent).toBeNull();
    });
  });

  describe('getBottomAction', () => {
    it('shows empty vote button for wolf', () => {
      const ctx = makeContext();
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe('空刀');
    });
  });

  // Contract: verify GameContext no longer has wolfKillDisabled
  describe('Contract: GameContext no longer has block-related fields', () => {
    it('GameContext does not have wolfKillDisabled', () => {
      const ctx = makeContext();
      // @ts-expect-error - wolfKillDisabled does not exist on GameContext
      expect(ctx.wolfKillDisabled).toBeUndefined();
    });

    it('GameContext does not have isBlockedByNightmare', () => {
      const ctx = makeContext();
      // @ts-expect-error - isBlockedByNightmare does not exist on GameContext
      expect(ctx.isBlockedByNightmare).toBeUndefined();
    });
  });
});
