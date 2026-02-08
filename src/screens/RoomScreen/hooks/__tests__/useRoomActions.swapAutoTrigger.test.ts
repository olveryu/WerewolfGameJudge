/**
 * Tests for getAutoTriggerIntent with swap schema (magician)
 *
 * Regression test for: Magician should not re-trigger actionPrompt
 * after selecting the first seat (anotherIndex is set).
 */
import { renderHook } from '@testing-library/react-native';

import { GameStatus } from '@/models/Room';
import { getSchema } from '@/models/roles/spec/schemas';
import type { LocalGameState } from '@/services/types/GameStateTypes';
import type { GameContext } from '@/screens/RoomScreen/hooks/useRoomActions';
import { useRoomActions } from '@/screens/RoomScreen/hooks/useRoomActions';

function makeContext(overrides: Partial<GameContext> = {}): GameContext {
  const base: GameContext = {
    gameState: { template: { roles: [] } } as unknown as LocalGameState,
    roomStatus: GameStatus.ongoing,
    currentActionRole: 'magician',
    currentSchema: getSchema('magicianSwap'),
    imActioner: true,
    actorSeatNumber: 0,
    actorRole: 'magician',
    isAudioPlaying: false,
    anotherIndex: null,
  };
  return { ...base, ...overrides };
}

const defaultDeps = {
  hasWolfVoted: () => false,
  getWolfVoteSummary: () => '0/0 狼人已投票',
  getWitchContext: () => null,
};

describe('useRoomActions.getAutoTriggerIntent (swap schema)', () => {
  it('returns actionPrompt when anotherIndex is null (first seat not yet selected)', () => {
    const ctx = makeContext({ anotherIndex: null });
    const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

    const intent = result.current.getAutoTriggerIntent();

    expect(intent).toEqual({ type: 'actionPrompt', targetIndex: -1 });
  });

  it('returns null when anotherIndex is set (first seat already selected)', () => {
    // This is the regression fix: after selecting first seat, should NOT re-trigger prompt
    const ctx = makeContext({ anotherIndex: 2 });
    const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

    const intent = result.current.getAutoTriggerIntent();

    expect(intent).toBeNull();
  });

  it('returns null when imActioner is false', () => {
    const ctx = makeContext({ imActioner: false });
    const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

    const intent = result.current.getAutoTriggerIntent();

    expect(intent).toBeNull();
  });

  it('returns null when audio is playing', () => {
    const ctx = makeContext({ isAudioPlaying: true });
    const { result } = renderHook(() => useRoomActions(ctx, defaultDeps));

    const intent = result.current.getAutoTriggerIntent();

    expect(intent).toBeNull();
  });
});
