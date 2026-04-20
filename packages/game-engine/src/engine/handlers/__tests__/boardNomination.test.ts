/**
 * Board Nomination Handler Tests
 */

import {
  handleBoardNominate,
  handleBoardUpvote,
  handleBoardWithdraw,
} from '@werewolf/game-engine/engine/handlers/gameControlHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type {
  BoardNominateIntent,
  BoardUpvoteIntent,
  BoardWithdrawIntent,
} from '@werewolf/game-engine/engine/intents/types';
import { handleUpvoteBoardNomination } from '@werewolf/game-engine/engine/reducer/lifecycleReducers';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import { expectError, expectSuccess } from './handlerTestUtils';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    roster: {},
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    myUid: 'player-1',
    mySeat: null,
    ...overrides,
  };
}

// =============================================================================
// handleBoardNominate
// =============================================================================

describe('handleBoardNominate', () => {
  const intent: BoardNominateIntent = {
    type: 'BOARD_NOMINATE',
    payload: {
      uid: 'player-1',
      displayName: 'Player 1',
      roles: ['villager', 'wolf', 'seer'],
    },
  };

  it('succeeds in Unseated status', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const ctx = createContext(state);
    const result = expectSuccess(handleBoardNominate(intent, ctx));
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('SET_BOARD_NOMINATION');
  });

  it('succeeds in Seated status', () => {
    const state = createMinimalState({ status: GameStatus.Seated });
    const ctx = createContext(state);
    const result = expectSuccess(handleBoardNominate(intent, ctx));
    expect(result.actions).toHaveLength(1);
  });

  it('rejects in Assigned status', () => {
    const state = createMinimalState({ status: GameStatus.Assigned });
    const ctx = createContext(state);
    expectError(handleBoardNominate(intent, ctx));
  });

  it('rejects in Ongoing status', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const ctx = createContext(state);
    expectError(handleBoardNominate(intent, ctx));
  });

  it('rejects empty roles', () => {
    const state = createMinimalState();
    const ctx = createContext(state);
    const emptyIntent: BoardNominateIntent = {
      ...intent,
      payload: { ...intent.payload, roles: [] },
    };
    expectError(handleBoardNominate(emptyIntent, ctx));
  });

  it('creates nomination with empty upvoters', () => {
    const state = createMinimalState();
    const ctx = createContext(state);
    const result = expectSuccess(handleBoardNominate(intent, ctx));
    const action = result.actions[0];
    expect(action.type).toBe('SET_BOARD_NOMINATION');
    if (action.type === 'SET_BOARD_NOMINATION') {
      expect(action.payload.nomination.uid).toBe('player-1');
      expect(action.payload.nomination.displayName).toBe('Player 1');
      expect(action.payload.nomination.upvoters).toEqual([]);
    }
  });

  // ── Dedup tests ─────────────────────────────────────────────────────────

  it('auto-upvotes when another user has identical roles', () => {
    const state = createMinimalState({
      boardNominations: {
        'player-2': {
          uid: 'player-2',
          displayName: 'Player 2',
          roles: ['villager', 'wolf', 'seer'],
          upvoters: [],
        },
      },
    });
    const ctx = createContext(state);
    const result = expectSuccess(handleBoardNominate(intent, ctx));
    expect(result.reason).toBe('DEDUPLICATED');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('UPVOTE_BOARD_NOMINATION');
    if (result.actions[0].type === 'UPVOTE_BOARD_NOMINATION') {
      expect(result.actions[0].payload.targetUid).toBe('player-2');
      expect(result.actions[0].payload.voterUid).toBe('player-1');
    }
  });

  it('deduplicates regardless of role order', () => {
    const state = createMinimalState({
      boardNominations: {
        'player-2': {
          uid: 'player-2',
          displayName: 'Player 2',
          roles: ['seer', 'villager', 'wolf'],
          upvoters: [],
        },
      },
    });
    const ctx = createContext(state);
    const result = expectSuccess(handleBoardNominate(intent, ctx));
    expect(result.reason).toBe('DEDUPLICATED');
    expect(result.actions[0].type).toBe('UPVOTE_BOARD_NOMINATION');
  });

  it('allows same user to overwrite their own identical nomination', () => {
    const state = createMinimalState({
      boardNominations: {
        'player-1': {
          uid: 'player-1',
          displayName: 'Player 1',
          roles: ['villager', 'wolf', 'seer'],
          upvoters: ['player-3'],
        },
      },
    });
    const ctx = createContext(state);
    const result = expectSuccess(handleBoardNominate(intent, ctx));
    expect(result.reason).toBeUndefined();
    expect(result.actions[0].type).toBe('SET_BOARD_NOMINATION');
  });

  it('does not deduplicate when roles differ', () => {
    const state = createMinimalState({
      boardNominations: {
        'player-2': {
          uid: 'player-2',
          displayName: 'Player 2',
          roles: ['villager', 'wolf', 'witch'],
          upvoters: [],
        },
      },
    });
    const ctx = createContext(state);
    const result = expectSuccess(handleBoardNominate(intent, ctx));
    expect(result.reason).toBeUndefined();
    expect(result.actions[0].type).toBe('SET_BOARD_NOMINATION');
  });
});

// =============================================================================
// handleBoardUpvote
// =============================================================================

describe('handleBoardUpvote', () => {
  const stateWithNomination = createMinimalState({
    boardNominations: {
      'player-1': {
        uid: 'player-1',
        displayName: 'Player 1',
        roles: ['villager', 'wolf', 'seer'],
        upvoters: [],
      },
    },
  });

  it('succeeds for valid upvote', () => {
    const intent: BoardUpvoteIntent = {
      type: 'BOARD_UPVOTE',
      payload: { targetUid: 'player-1', voterUid: 'player-2' },
    };
    const ctx = createContext(stateWithNomination, { myUid: 'player-2' });
    const result = expectSuccess(handleBoardUpvote(intent, ctx));
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('UPVOTE_BOARD_NOMINATION');
  });

  it('allows self-upvote', () => {
    const intent: BoardUpvoteIntent = {
      type: 'BOARD_UPVOTE',
      payload: { targetUid: 'player-1', voterUid: 'player-1' },
    };
    const ctx = createContext(stateWithNomination);
    const result = expectSuccess(handleBoardUpvote(intent, ctx));
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('UPVOTE_BOARD_NOMINATION');
  });

  it('rejects when target nomination does not exist', () => {
    const intent: BoardUpvoteIntent = {
      type: 'BOARD_UPVOTE',
      payload: { targetUid: 'nonexistent', voterUid: 'player-2' },
    };
    const ctx = createContext(stateWithNomination, { myUid: 'player-2' });
    expectError(handleBoardUpvote(intent, ctx));
  });

  it('rejects in Assigned status', () => {
    const state = createMinimalState({
      status: GameStatus.Assigned,
      boardNominations: stateWithNomination.boardNominations,
    });
    const intent: BoardUpvoteIntent = {
      type: 'BOARD_UPVOTE',
      payload: { targetUid: 'player-1', voterUid: 'player-2' },
    };
    const ctx = createContext(state, { myUid: 'player-2' });
    expectError(handleBoardUpvote(intent, ctx));
  });
});

// =============================================================================
// handleBoardWithdraw
// =============================================================================

describe('handleBoardWithdraw', () => {
  const stateWithNomination = createMinimalState({
    boardNominations: {
      'player-1': {
        uid: 'player-1',
        displayName: 'Player 1',
        roles: ['villager', 'wolf', 'seer'],
        upvoters: [],
      },
    },
  });

  it('succeeds for own nomination', () => {
    const intent: BoardWithdrawIntent = {
      type: 'BOARD_WITHDRAW',
      payload: { uid: 'player-1' },
    };
    const ctx = createContext(stateWithNomination);
    const result = expectSuccess(handleBoardWithdraw(intent, ctx));
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('WITHDRAW_BOARD_NOMINATION');
  });

  it('rejects when nomination does not exist', () => {
    const intent: BoardWithdrawIntent = {
      type: 'BOARD_WITHDRAW',
      payload: { uid: 'nonexistent' },
    };
    const ctx = createContext(stateWithNomination);
    expectError(handleBoardWithdraw(intent, ctx));
  });

  it('rejects in Ongoing status', () => {
    const state = createMinimalState({
      status: GameStatus.Ongoing,
      boardNominations: stateWithNomination.boardNominations,
    });
    const intent: BoardWithdrawIntent = {
      type: 'BOARD_WITHDRAW',
      payload: { uid: 'player-1' },
    };
    const ctx = createContext(state);
    expectError(handleBoardWithdraw(intent, ctx));
  });
});

// =============================================================================
// handleUpvoteBoardNomination (reducer — single-vote constraint)
// =============================================================================

describe('handleUpvoteBoardNomination (reducer)', () => {
  const baseState = createMinimalState({
    boardNominations: {
      'player-1': {
        uid: 'player-1',
        displayName: 'Player 1',
        roles: ['villager', 'wolf', 'seer'],
        upvoters: [],
      },
      'player-2': {
        uid: 'player-2',
        displayName: 'Player 2',
        roles: ['wolf', 'seer', 'villager'],
        upvoters: [],
      },
    },
  });

  it('adds vote', () => {
    const result = handleUpvoteBoardNomination(baseState, {
      type: 'UPVOTE_BOARD_NOMINATION',
      payload: { targetUid: 'player-1', voterUid: 'player-3' },
    });
    expect(result.boardNominations!['player-1'].upvoters).toEqual(['player-3']);
    expect(result.boardNominations!['player-2'].upvoters).toEqual([]);
  });

  it('toggles off on second click', () => {
    const voted = handleUpvoteBoardNomination(baseState, {
      type: 'UPVOTE_BOARD_NOMINATION',
      payload: { targetUid: 'player-1', voterUid: 'player-3' },
    });
    const toggled = handleUpvoteBoardNomination(voted, {
      type: 'UPVOTE_BOARD_NOMINATION',
      payload: { targetUid: 'player-1', voterUid: 'player-3' },
    });
    expect(toggled.boardNominations!['player-1'].upvoters).toEqual([]);
  });

  it('auto-switches vote to new nomination', () => {
    const votedA = handleUpvoteBoardNomination(baseState, {
      type: 'UPVOTE_BOARD_NOMINATION',
      payload: { targetUid: 'player-1', voterUid: 'player-3' },
    });
    expect(votedA.boardNominations!['player-1'].upvoters).toEqual(['player-3']);

    const votedB = handleUpvoteBoardNomination(votedA, {
      type: 'UPVOTE_BOARD_NOMINATION',
      payload: { targetUid: 'player-2', voterUid: 'player-3' },
    });
    expect(votedB.boardNominations!['player-1'].upvoters).toEqual([]);
    expect(votedB.boardNominations!['player-2'].upvoters).toEqual(['player-3']);
  });
});
