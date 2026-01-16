import { renderHook } from '@testing-library/react-native';

import { RoomStatus } from '../../../../models/Room';
import type { LocalGameState } from '../../../../services/types/GameStateTypes';
import type { GameContext } from '../../hooks/useRoomActions';
import { useRoomActions } from '../../hooks/useRoomActions';
import type { ActionSchema } from '../../../../models/roles/spec';

function makeContext(overrides: Partial<GameContext> = {}): GameContext {
  const base: GameContext = {
    gameState: ({ template: { roles: [] } } as unknown as LocalGameState),
    roomStatus: RoomStatus.ongoing,
    currentActionRole: null,
    currentSchema: null,
    imActioner: true,
    mySeatNumber: 0,
    myRole: 'seer',
    isAudioPlaying: false,
    isBlockedByNightmare: false,
    anotherIndex: null,
  };
  return { ...base, ...overrides };
}

describe('useRoomActions.getBottomAction (UI-only)', () => {
  it('shows blocked skip label when nightmare-blocked', () => {
    const ctx = makeContext({ isBlockedByNightmare: true });
    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '0/0 狼人已投票',
        getWitchContext: () => null,
      })
    );
    expect(result.current.getBottomAction()).toEqual({
      buttons: [
        {
          key: 'skip',
          label: '跳过（技能被封锁）',
          intent: {
            type: 'skip',
            targetIndex: -1,
            message: '跳过（技能被封锁）',
          },
        },
      ],
    });
  });

  it('shows wolf empty-vote label from schema.ui.emptyVoteText (fallback 投票空刀)', () => {
    const wolfVoteSchema: ActionSchema = {
      id: 'wolfVote',
      kind: 'wolfVote',
  displayName: '狼刀',
  constraints: [],
      ui: {
        prompt: 'x',
        confirmTitle: 'x',
        confirmText: 'x',
        emptyVoteText: '空刀',
      },
    };

    const ctx = makeContext({ currentSchema: wolfVoteSchema });
    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '1/3 狼人已投票',
        getWitchContext: () => null,
      })
    );

    expect(result.current.getBottomAction()).toEqual({
      buttons: [
        {
          key: 'wolfEmpty',
          label: '空刀',
          intent: {
            type: 'wolfVote',
            targetIndex: -1,
          },
        },
      ],
    });
  });

  it('hides when chooseSeat schema has canSkip=false', () => {
    const chooseSeatSchema: ActionSchema = {
      id: 'seerAction',
      kind: 'chooseSeat',
  displayName: '查验',
  constraints: [],
      canSkip: false,
      ui: {
        prompt: 'x',
        confirmTitle: 'x',
        confirmText: 'x',
        bottomActionText: '不查验',
      },
    };

    const ctx = makeContext({ currentSchema: chooseSeatSchema });
    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => true,
        getWolfVoteSummary: () => '0/0 狼人已投票',
        getWitchContext: () => null,
      })
    );

  expect(result.current.getBottomAction()).toEqual({ buttons: [] });
  });
});
