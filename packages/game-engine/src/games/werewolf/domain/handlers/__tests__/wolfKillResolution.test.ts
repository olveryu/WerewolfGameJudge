/**
 * wolfKillResolution.ts unit tests
 *
 * The settled target and its verdict are computed together from the
 * same votes and the same random pick: every case below asserts both
 * at once, and the verdict's targetSeat (when present) always equals
 * the target. A verdict computed apart from the target, or a second
 * random pick for the verdict, would fail these assertions.
 */

import {
  classifyWolfKillVerdict,
  maybeCreateResolvedWolfKillTargetAction,
  settleWolfKillFromVotes,
} from '@game-judge/game-engine/games/werewolf/domain/handlers/wolfKillResolution';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { GameState } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';

function createState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: '1234',
    hostUserId: 'host-uid',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'wolf', 'villager', 'villager'],
    players: {},
    nightStep: { kind: 'inStep', stepId: 'wolfKill' },
    actions: [],
    currentNightResults: {},
    pendingRevealAcks: [],
    roster: {},
    isAudioPlaying: false,
    ...overrides,
  } as GameState;
}

describe('settleWolfKillFromVotes', () => {
  it('settles a unanimous vote to sharedTarget', () => {
    const state = createState({ currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } } });
    const settled = settleWolfKillFromVotes(state, () => 0);
    expect(settled.target).toBe(4);
    expect(settled.verdict).toEqual({ type: 'sharedTarget', targetSeat: 4 });
  });

  it('settles a plurality vote to splitKilled with the plurality target', () => {
    const state = createState({
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4, '2': 5 } },
    });
    const settled = settleWolfKillFromVotes(state, () => 0);
    expect(settled.target).toBe(4);
    expect(settled.verdict).toEqual({ type: 'splitKilled', targetSeat: 4 });
  });

  it('settles a tied vote to tiePicked with the picked target, not a second pick', () => {
    const state = createState({ currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } } });
    const firstPick = settleWolfKillFromVotes(state, () => 0);
    expect(firstPick.target).toBe(4);
    expect(firstPick.verdict).toEqual({ type: 'tiePicked', targetSeat: 4 });
    const lastPick = settleWolfKillFromVotes(state, () => 0.99);
    expect(lastPick.target).toBe(5);
    expect(lastPick.verdict).toEqual({ type: 'tiePicked', targetSeat: 5 });
  });

  it('settles a cupid 2-to-1 vote to splitTied, never to a plurality kill', () => {
    const state = createState({
      templateRoles: ['wolf', 'wolf', 'wolf', 'cupid', 'villager'],
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4, '2': 5 } },
    });
    const settled = settleWolfKillFromVotes(state, () => 0);
    expect(settled.target).toBeNull();
    expect(settled.verdict).toEqual({ type: 'splitTied' });
  });

  it('settles a cupid tied vote to splitTied', () => {
    const state = createState({
      templateRoles: ['wolf', 'wolf', 'cupid', 'villager'],
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } },
    });
    const settled = settleWolfKillFromVotes(state, () => 0);
    expect(settled.target).toBeNull();
    expect(settled.verdict).toEqual({ type: 'splitTied' });
  });

  it('settles a cupid unanimous vote to sharedTarget', () => {
    const state = createState({
      templateRoles: ['wolf', 'wolf', 'cupid', 'villager'],
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
    });
    const settled = settleWolfKillFromVotes(state, () => 0);
    expect(settled.target).toBe(4);
    expect(settled.verdict).toEqual({ type: 'sharedTarget', targetSeat: 4 });
  });

  it('settles abstentions and empty votes to allAbstain', () => {
    const abstain = createState({ currentNightResults: { wolfVotesBySeat: { '0': -1, '1': -1 } } });
    expect(settleWolfKillFromVotes(abstain, () => 0)).toEqual({
      target: null,
      verdict: { type: 'allAbstain' },
    });
    const empty = createState({ currentNightResults: { wolfVotesBySeat: {} } });
    expect(settleWolfKillFromVotes(empty, () => 0)).toEqual({
      target: null,
      verdict: { type: 'allAbstain' },
    });
  });

  it('settles a wolf-kill override to no kill with no vote verdict, never splitTied', () => {
    const state = createState({
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } },
      wolfKillOverride: {
        source: 'nightmare',
        ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
      },
    });
    expect(settleWolfKillFromVotes(state, () => 0)).toEqual({ target: null, verdict: null });
  });
});

describe('classifyWolfKillVerdict', () => {
  it('classifies a known tied target as tiePicked without re-rolling', () => {
    const state = createState({ currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } } });
    expect(classifyWolfKillVerdict(state, 5)).toEqual({ type: 'tiePicked', targetSeat: 5 });
  });

  it('classifies a known plurality target as splitKilled', () => {
    const state = createState({
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4, '2': 5 } },
    });
    expect(classifyWolfKillVerdict(state, 4)).toEqual({ type: 'splitKilled', targetSeat: 4 });
  });

  it('classifies a known unanimous target as sharedTarget', () => {
    const state = createState({ currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } } });
    expect(classifyWolfKillVerdict(state, 4)).toEqual({ type: 'sharedTarget', targetSeat: 4 });
  });

  it('classifies a known null target with no votes as allAbstain', () => {
    const state = createState({ currentNightResults: { wolfVotesBySeat: { '0': -1 } } });
    expect(classifyWolfKillVerdict(state, null)).toEqual({ type: 'allAbstain' });
  });

  it('classifies a known null target under an override as no verdict', () => {
    const state = createState({
      currentNightResults: { wolfVotesBySeat: { '0': 4 } },
      wolfKillOverride: {
        source: 'nightmare',
        ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
      },
    });
    expect(classifyWolfKillVerdict(state, null)).toBeNull();
  });
});

describe('maybeCreateResolvedWolfKillTargetAction', () => {
  it('emits one SET carrying the target and the verdict together', () => {
    const state = createState({ currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } } });
    const action = maybeCreateResolvedWolfKillTargetAction(state, () => 0);
    expect(action).toEqual({
      type: 'SET_RESOLVED_WOLF_KILL_TARGET',
      payload: { target: 4, verdict: { type: 'tiePicked', targetSeat: 4 } },
    });
  });

  it('emits nothing once a target is already stored', () => {
    const state = createState({
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } },
      resolvedWolfKillTarget: 5,
      resolvedWolfKillVerdict: { type: 'tiePicked', targetSeat: 5 },
    });
    expect(maybeCreateResolvedWolfKillTargetAction(state, () => 0)).toBeNull();
  });
});
