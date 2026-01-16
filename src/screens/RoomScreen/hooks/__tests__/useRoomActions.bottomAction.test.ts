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

  // BUG LOCK: Blocked wolves should send wolfVote intent (not skip) to avoid skipping entire phase
  // Issue: When one wolf is blocked and clicks "skip", it should only record their vote (-1),
  // not advance the entire wolfKill phase before other wolves have voted.
  it('blocked wolf during wolfVote should use wolfVote intent (not skip)', () => {
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

    const ctx = makeContext({
      isBlockedByNightmare: true,
      currentSchema: wolfVoteSchema,
      myRole: 'wolf',
    });
    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '0/2 狼人已投票',
        getWitchContext: () => null,
      })
    );

    const bottomAction = result.current.getBottomAction();
    // Must use wolfVote intent (not skip) so only this wolf's vote is recorded
    expect(bottomAction.buttons).toHaveLength(1);
    expect(bottomAction.buttons[0].intent.type).toBe('wolfVote');
    expect(bottomAction.buttons[0].intent.targetIndex).toBe(-1);
    expect(bottomAction.buttons[0].label).toBe('跳过（技能被封锁）');
  });
});

describe('useRoomActions.getActionIntent (blocked player)', () => {
  // BUG LOCK: Blocked players tapping seats should get 'blocked' intent (not action confirm)
  // so UI can show "你被封锁了" feedback instead of confirm dialog that does nothing.
  it('blocked player tapping seat returns blocked intent', () => {
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
      },
    };

    const ctx: GameContext = {
      gameState: ({ template: { roles: [] } } as unknown as LocalGameState),
      roomStatus: RoomStatus.ongoing,
      currentActionRole: 'seer',
      currentSchema: chooseSeatSchema,
      imActioner: true,
      mySeatNumber: 0,
      myRole: 'seer',
      isAudioPlaying: false,
      isBlockedByNightmare: true,  // BLOCKED
      anotherIndex: null,
    };

    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '',
        getWitchContext: () => null,
      })
    );

    const intent = result.current.getActionIntent(3);
    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('blocked');
    expect(intent?.targetIndex).toBe(3);
  });

  it('non-blocked player tapping seat returns normal intent', () => {
    const chooseSeatSchema: ActionSchema = {
      id: 'seerAction',
      kind: 'chooseSeat',
      displayName: '查验',
      constraints: [],
      canSkip: false,
      ui: {
        prompt: 'x',
        confirmTitle: 'x',
        confirmText: 'confirm?',
        revealKind: 'seer',
      },
    };

    const ctx: GameContext = {
      gameState: ({ template: { roles: [] } } as unknown as LocalGameState),
      roomStatus: RoomStatus.ongoing,
      currentActionRole: 'seer',
      currentSchema: chooseSeatSchema,
      imActioner: true,
      mySeatNumber: 0,
      myRole: 'seer',
      isAudioPlaying: false,
      isBlockedByNightmare: false,  // NOT blocked
      anotherIndex: null,
    };

    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '',
        getWitchContext: () => null,
      })
    );

    const intent = result.current.getActionIntent(3);
    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('reveal');  // seer uses reveal intent
    expect(intent?.targetIndex).toBe(3);
  });
});
