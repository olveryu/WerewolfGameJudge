import { renderHook } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';

import {
  type ActionDeps,
  type GameContext,
  useRoomActions,
} from '@/screens/RoomScreen/hooks/useRoomActions';
import type { LocalGameState } from '@/types/GameStateTypes';

function makeContext(partial: Partial<GameContext>): GameContext {
  return {
    gameState: null,
    roomStatus: GameStatus.ongoing,
    currentActionRole: null,
    currentSchema: null,
    imActioner: true,
    actorSeatNumber: null,
    actorRole: null,
    isAudioPlaying: false,
    firstSwapSeat: null,
    ...partial,
  };
}

function makeDeps(partial: Partial<ActionDeps>): ActionDeps {
  return {
    hasWolfVoted: () => false,
    getWolfVoteSummary: () => '1/3 狼人已投票',
    getWitchContext: () => null,
    ...partial,
  };
}

describe('useRoomActions.getWolfStatusLine (UI-only)', () => {
  it('returns null when not wolf', () => {
    const ctx = makeContext({
      actorRole: 'villager',
      actorSeatNumber: 0,
      currentSchema: { kind: 'wolfVote' } as ActionSchema,
    });
    const deps = makeDeps({});

    const { result } = renderHook(() => useRoomActions(ctx, deps));
    expect(result.current.getWolfStatusLine()).toBeNull();
  });

  it('returns null when schema is not wolfVote', () => {
    const ctx = makeContext({
      actorRole: 'wolf',
      actorSeatNumber: 0,
      currentSchema: { kind: 'chooseSeat' } as ActionSchema,
    });
    const deps = makeDeps({});

    const { result } = renderHook(() => useRoomActions(ctx, deps));
    expect(result.current.getWolfStatusLine()).toBeNull();
  });

  it('returns only summary when I have not voted yet', () => {
    const ctx = makeContext({
      actorRole: 'wolf',
      actorSeatNumber: 2,
      currentSchema: { kind: 'wolfVote' } as ActionSchema,
      gameState: {} as LocalGameState,
    });
    const deps = makeDeps({
      hasWolfVoted: () => false,
      getWolfVoteSummary: () => '0/3 狼人已投票',
    });

    const { result } = renderHook(() => useRoomActions(ctx, deps));
    expect(result.current.getWolfStatusLine()).toBe('0/3 狼人已投票');
  });

  it('adds suffix when I have voted (or seat is null)', () => {
    const ctx = makeContext({
      actorRole: 'wolf',
      actorSeatNumber: 1,
      currentSchema: { kind: 'wolfVote' } as ActionSchema,
      gameState: {} as LocalGameState,
    });
    const deps = makeDeps({
      hasWolfVoted: () => true,
      getWolfVoteSummary: () => '1/3 狼人已投票',
    });

    const { result } = renderHook(() => useRoomActions(ctx, deps));
    expect(result.current.getWolfStatusLine()).toBe('1/3 狼人已投票（可点击改票或取消）');
  });
});
