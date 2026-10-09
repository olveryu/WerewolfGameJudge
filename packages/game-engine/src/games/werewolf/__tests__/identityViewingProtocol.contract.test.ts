/**
 * Identity Viewing Protocol — werewolf scenario (P-1 batch A).
 *
 * Werewolf is the protocol's reference implementation: the engine keeps
 * a per-player hasViewedRole record (false at deal time), the viewed
 * action flips it idempotently, and the status advances Assigned ->
 * Ready only when every seated player has viewed. Bot seats never
 * block: the host marks them viewed (mark-all-bots) before the flip.
 * Same-named scenario files live in each compliant game's __tests__.
 */

import {
  haveAllHumansViewed,
  type IdentityViewingParticipant,
} from '../../../platform/room/identityViewing';
import { GameStatus } from '../domain/models/GameStatus';
import type { GameState } from '../domain/protocol/types';
import { handlePlayerViewedRole } from '../domain/reducer/lifecycleReducers';
import { WEREWOLF_STATE_IDENTITY } from '../state/version';

function createAssignedState(): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Assigned,
    templateRoles: ['wolf', 'seer', 'villager'],
    players: {
      0: { userId: 'p0', seat: 0, role: 'seer', hasViewedRole: false },
      1: { userId: 'p1', seat: 1, role: 'wolf', hasViewedRole: false },
      2: { userId: 'p2', seat: 2, role: 'villager', hasViewedRole: false },
    },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {},
  };
}

function view(state: GameState, seat: number): GameState {
  return handlePlayerViewedRole(state, { type: 'PLAYER_VIEWED_ROLE', payload: { seat } });
}

function viewedSeats(state: GameState): readonly number[] {
  const seats: number[] = [];
  for (const player of Object.values(state.players)) {
    if (player !== null && player.hasViewedRole) seats.push(player.seat);
  }
  return seats;
}

describe('Identity Viewing Protocol — werewolf record and Ready checkpoint', () => {
  it('holds Assigned until every seated player has viewed, then advances to Ready', () => {
    let state = createAssignedState();
    expect(viewedSeats(state)).toEqual([]);

    state = view(state, 0);
    expect(state.players[0]?.hasViewedRole).toBe(true);
    expect(state.status).toBe(GameStatus.Assigned);

    state = view(state, 2);
    expect(state.status).toBe(GameStatus.Assigned);

    state = view(state, 1);
    expect(state.status).toBe(GameStatus.Ready);
  });

  it('marks idempotently: viewing the same seat twice changes nothing further', () => {
    let state = createAssignedState();
    state = view(state, 1);
    const afterFirst = state;
    state = view(state, 1);
    expect(state.players).toEqual(afterFirst.players);
    expect(state.status).toBe(afterFirst.status);
    expect(viewedSeats(state)).toEqual([1]);
  });

  it('agrees with the shared checkpoint predicate at every step', () => {
    let state = createAssignedState();
    const participants: readonly IdentityViewingParticipant[] = [0, 1, 2].map((seat) => ({
      seat,
      isBot: false,
    }));
    for (const seat of [0, 2, 1]) {
      expect(haveAllHumansViewed(participants, viewedSeats(state))).toBe(
        state.status === GameStatus.Ready,
      );
      state = view(state, seat);
    }
    expect(state.status).toBe(GameStatus.Ready);
    expect(haveAllHumansViewed(participants, viewedSeats(state))).toBe(true);
  });
});
