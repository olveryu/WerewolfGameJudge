/**
 * useRoomActions.getBottomAction and getActionIntent tests (Host-authoritative)
 *
 * NEW BEHAVIOR:
 * - UI does NOT intercept blocked players
 * - Blocked players get normal intent (not 'blocked')
 * - Bottom buttons show normal labels (not forced skip)
 * - Host handles all blocking via ACTION_REJECTED
 */
import { renderHook } from '@testing-library/react-native';

import { GameStatus } from '@/models/Room';
import type { LocalGameState } from '@/types/GameStateTypes';
import type { GameContext } from '@/screens/RoomScreen/hooks/useRoomActions';
import { useRoomActions } from '@/screens/RoomScreen/hooks/useRoomActions';
import type { ActionSchema } from '@/models/roles/spec';

function makeContext(overrides: Partial<GameContext> = {}): GameContext {
  const base: GameContext = {
    gameState: { template: { roles: [] } } as unknown as LocalGameState,
    roomStatus: GameStatus.ongoing,
    currentActionRole: null,
    currentSchema: null,
    imActioner: true,
    actorSeatNumber: 0,
    actorRole: 'seer',
    isAudioPlaying: false,
    anotherIndex: null,
  };
  return { ...base, ...overrides };
}

describe('useRoomActions.getBottomAction (Host-authoritative)', () => {
  it('shows normal skip button when nightmare-blocked (no forced label)', () => {
    const chooseSeatSchema: ActionSchema = {
      id: 'seerAction',
      kind: 'chooseSeat',
      displayName: '查验',
      constraints: [],
      canSkip: true,
      ui: {
        prompt: 'x',
        confirmTitle: 'x',
        confirmText: 'x',
        bottomActionText: '不查验',
      },
    };

    const ctx = makeContext({
      currentSchema: chooseSeatSchema,
    });
    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '0/0 狼人已投票',
        getWitchContext: () => null,
      }),
    );

    // UI no longer forces skip - shows normal schema button
    const bottomAction = result.current.getBottomAction();
    expect(bottomAction.buttons).toHaveLength(1);
    expect(bottomAction.buttons[0].key).toBe('skip');
    expect(bottomAction.buttons[0].label).toBe('不查验');
  });

  it('shows wolf empty-vote label from schema.ui.emptyVoteText', () => {
    const wolfVoteSchema: ActionSchema = {
      id: 'wolfVote',
      kind: 'wolfVote',
      displayName: '狼刀',
      constraints: [],
      meeting: {
        canSeeEachOther: true,
        resolution: 'firstVote',
        allowEmptyVote: true,
      },
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
      }),
    );

    expect(result.current.getBottomAction()).toEqual({
      buttons: [
        {
          key: 'wolfEmpty',
          label: '空刀',
          intent: {
            type: 'wolfVote',
            targetIndex: -1,
            wolfSeat: 0,
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
      }),
    );

    expect(result.current.getBottomAction()).toEqual({ buttons: [] });
  });

  it('blocked wolf during wolfVote shows normal empty vote (no forced skip)', () => {
    const wolfVoteSchema: ActionSchema = {
      id: 'wolfVote',
      kind: 'wolfVote',
      displayName: '狼刀',
      constraints: [],
      meeting: {
        canSeeEachOther: true,
        resolution: 'firstVote',
        allowEmptyVote: true,
      },
      ui: {
        prompt: 'x',
        confirmTitle: 'x',
        confirmText: 'x',
        emptyVoteText: '空刀',
      },
    };

    const ctx = makeContext({
      currentSchema: wolfVoteSchema,
      actorRole: 'wolf',
    });
    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '0/2 狼人已投票',
        getWitchContext: () => null,
      }),
    );

    const bottomAction = result.current.getBottomAction();
    // UI no longer forces skip - normal wolfVote button
    expect(bottomAction.buttons).toHaveLength(1);
    expect(bottomAction.buttons[0].intent.type).toBe('wolfVote');
    expect(bottomAction.buttons[0].intent.targetIndex).toBe(-1);
    expect(bottomAction.buttons[0].label).toBe('空刀');
  });
});

describe('useRoomActions.getActionIntent (Host-authoritative)', () => {
  it('blocked player tapping seat returns normal intent (Host validates)', () => {
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
      gameState: { template: { roles: [] } } as unknown as LocalGameState,
      roomStatus: GameStatus.ongoing,
      currentActionRole: 'seer',
      currentSchema: chooseSeatSchema,
      imActioner: true,
      actorSeatNumber: 0,
      actorRole: 'seer',
      isAudioPlaying: false,
      anotherIndex: null,
    };

    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '',
        getWitchContext: () => null,
      }),
    );

    const intent = result.current.getActionIntent(3);
    // UI no longer intercepts - returns normal reveal intent
    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('reveal');
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
      gameState: { template: { roles: [] } } as unknown as LocalGameState,
      roomStatus: GameStatus.ongoing,
      currentActionRole: 'seer',
      currentSchema: chooseSeatSchema,
      imActioner: true,
      actorSeatNumber: 0,
      actorRole: 'seer',
      isAudioPlaying: false,
      anotherIndex: null,
    };

    const { result } = renderHook(() =>
      useRoomActions(ctx, {
        hasWolfVoted: () => false,
        getWolfVoteSummary: () => '',
        getWitchContext: () => null,
      }),
    );

    const intent = result.current.getActionIntent(3);
    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('reveal');
    expect(intent?.targetIndex).toBe(3);
  });
});
