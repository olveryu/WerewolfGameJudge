/**
 * Identity Viewing Protocol — werewolf scenario (P-1 batch A).
 *
 * Werewolf is the protocol's reference implementation: the engine keeps
 * a per-player hasViewedRole record (false at deal time), the viewed
 * action flips it idempotently, and the status advances Assigned ->
 * Ready only when every seated player has viewed - bot seats count
 * like everyone else; the host marks them viewed (mark-all-bots)
 * through the scaffold action. Same-named scenario files live in
 * each compliant game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import { REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import { describeIdentityViewingProtocol } from '../../../platform/room/__tests__/identityViewingScenarios';
import {
  haveAllViewed,
  type IdentityViewingParticipant,
} from '../../../platform/room/identityViewing';
import { GameStatus } from '../domain/models/GameStatus';
import { getWerewolfViewingParticipants } from '../domain/playerHelpers';
import type { GameState } from '../domain/protocol/types';
import { handlePlayerViewedRole } from '../domain/reducer/lifecycleReducers';
import { werewolfEngine } from '../engine';
import { WEREWOLF_STATE_IDENTITY } from '../state/version';

function hostContext(): CommandContext {
  return {
    actor: { kind: 'user', userId: 'host-1' },
    controlledSeat: null,
    commandId: 'mark-bots',
    randomSeed: 'identity-viewing',
    nowMs: 1_000,
  };
}

function userContext(userId: string): CommandContext {
  return { ...hostContext(), actor: { kind: 'user', userId }, commandId: 'confirm' };
}

/** The scaffold action, driven through the engine's decide (F-3). */
function markAllBotsViewed(state: GameState): GameState {
  // Werewolf's checkpoint auto-flips Assigned -> Ready the moment the
  // last record lands, and the scaffold only runs inside the Assigned
  // window; in Ready the bot records are complete by construction, so
  // a trailing scaffold call is already satisfied.
  if (state.status === GameStatus.Ready) return state;
  const decision = werewolfEngine.decide(
    state,
    { type: 'werewolf.bots.markAllBotsViewed' },
    hostContext(),
  );
  if (decision.kind === 'reject') {
    throw new Error(`markAllBotsViewed rejected: ${decision.reason}`);
  }
  return decision.events.reduce((next, event) => werewolfEngine.evolve(next, event), state);
}

function createAssignedState(): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Assigned,
    templateRoles: ['wolf', 'seer', 'villager'],
    players: {
      0: { seat: 0, role: 'seer', hasViewedRole: false },
      1: { seat: 1, role: 'wolf', hasViewedRole: false },
      2: { seat: 2, role: 'villager', hasViewedRole: false },
    },
    nightStep: null,
    isAudioPlaying: false,
    pendingAudioEffects: [],
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {
      0: { seat: 0, userId: 'p0' },
      1: { seat: 1, userId: 'p1' },
      2: { seat: 2, userId: 'p2' },
    },
    playerProfiles: {},
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
      expect(haveAllViewed(participants, viewedSeats(state))).toBe(
        state.status === GameStatus.Ready,
      );
      state = view(state, seat);
    }
    expect(state.status).toBe(GameStatus.Ready);
    expect(haveAllViewed(participants, viewedSeats(state))).toBe(true);
  });
});

describe('Identity Viewing Protocol - werewolf bot seats count at the checkpoint', () => {
  it('holds Assigned while a bot seat is unmarked, even with every human viewed', () => {
    const base = createAssignedState();
    let state: GameState = {
      ...base,
      roster: { ...base.roster, 2: { seat: 2, kind: 'bot' } },
    };

    state = view(state, 0);
    state = view(state, 1);
    expect(state.status).toBe(GameStatus.Assigned);
    expect(viewedSeats(state)).toEqual([0, 1]);

    state = markAllBotsViewed(state);
    expect(viewedSeats(state)).toEqual([0, 1, 2]);
    expect(state.status).toBe(GameStatus.Ready);
  });
});

describe('Identity Viewing Protocol — werewolf confirm through the shared skeleton (D-2)', () => {
  it('confirms an unviewed seat in the Assigned window', () => {
    const decision = werewolfEngine.decide(
      createAssignedState(),
      { type: 'werewolf.role.viewed' },
      userContext('p0'),
    );
    if (decision.kind !== 'commit') throw new Error('Expected commit');
    expect(decision.events).toEqual([{ type: 'PLAYER_VIEWED_ROLE', payload: { seat: 0 } }]);
  });

  it('still confirms an already-viewed seat after the checkpoint flipped to Ready', () => {
    let state = createAssignedState();
    state = view(view(state, 0), 1);
    state = view(state, 2);
    expect(state.status).toBe(GameStatus.Ready);
    const decision = werewolfEngine.decide(
      state,
      { type: 'werewolf.role.viewed' },
      userContext('p0'),
    );
    if (decision.kind !== 'commit') throw new Error('Expected commit');
    expect(decision.events).toEqual([]);
  });

  it('rejects an unviewed confirmation outside the Assigned window', () => {
    const state: GameState = { ...createAssignedState(), status: GameStatus.Seated };
    expect(
      werewolfEngine.decide(state, { type: 'werewolf.role.viewed' }, userContext('p0')),
    ).toEqual({ kind: 'reject', reason: 'invalid_status' });
  });

  it('rejects a confirmation from a user with no seat', () => {
    expect(
      werewolfEngine.decide(
        createAssignedState(),
        { type: 'werewolf.role.viewed' },
        userContext('outsider'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_NOT_SEATED });
  });
});

describeIdentityViewingProtocol({
  game: 'werewolf',
  makeSession: () => {
    const base = createAssignedState();
    let state: GameState = { ...base, roster: { ...base.roster, 2: { seat: 2, kind: 'bot' } } };
    return {
      viewedSeats: () => viewedSeats(state),
      participants: () => getWerewolfViewingParticipants(state),
      view: (seat) => {
        state = view(state, seat);
      },
      markAllBotsViewed: () => {
        state = markAllBotsViewed(state);
      },
      isCheckpointOpen: () => state.status === GameStatus.Ready,
    };
  },
});
