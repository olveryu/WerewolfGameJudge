/**
 * Tests for wolfKillDisabled behavior (Host-authoritative version)
 *
 * NEW BEHAVIOR:
 * - UI does NOT intercept wolfKillDisabled
 * - Wolf can still tap seats and get normal intent
 * - Host validates and rejects via ACTION_REJECTED
 * - UI shows normal buttons (not forced empty)
 */
import { renderHook } from '@testing-library/react-native';

import { GameStatus } from '../../../../models/Room';
import { getSchema } from '../../../../models/roles/spec';
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

describe('useRoomActions with wolfKillDisabled (Host-authoritative)', () => {
  describe('getActionIntent', () => {
    it('returns wolfVote intent when wolfKillDisabled is false', () => {
      const ctx = makeContext({ wolfKillDisabled: false });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('wolfVote');
      expect(intent?.targetIndex).toBe(3);
    });

    it('returns normal wolfVote intent even when wolfKillDisabled is true (no UI block)', () => {
      const ctx = makeContext({ wolfKillDisabled: true });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      // UI no longer intercepts - Host will reject
      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('wolfVote');
      expect(intent?.targetIndex).toBe(3);
    });

    it('returns null for non-wolf (not their turn)', () => {
      const ctx = makeContext({
        wolfKillDisabled: false,
        myRole: 'seer',
        imActioner: false,
      });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const intent = result.current.getActionIntent(3);
      expect(intent).toBeNull();
    });
  });

  describe('getBottomAction', () => {
    it('shows empty vote button when wolfKillDisabled is false', () => {
      const ctx = makeContext({ wolfKillDisabled: false });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const bottomAction = result.current.getBottomAction();
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe('空刀');
    });

    it('shows normal empty vote button even when wolfKillDisabled is true (no forced skip)', () => {
      const ctx = makeContext({ wolfKillDisabled: true });
      const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

      const bottomAction = result.current.getBottomAction();
      // UI no longer forces skip button - normal empty vote
      expect(bottomAction.buttons).toHaveLength(1);
      expect(bottomAction.buttons[0].key).toBe('wolfEmpty');
      expect(bottomAction.buttons[0].label).toBe('空刀');
    });
  });
});
