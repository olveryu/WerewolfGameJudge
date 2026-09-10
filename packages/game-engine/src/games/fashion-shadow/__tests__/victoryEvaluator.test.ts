import type { CommandContext, CreateGameContext } from '../../../platform/engine';
import type { FashionCommand } from '../commands/types';
import { evaluateFashionVictory } from '../domain/victoryEvaluator';
import { fashionEngine } from '../engine';
import {
  FASHION_PLAYER_COUNT,
  type FashionInvestigationVote,
  type FashionRoleId,
  type FashionState,
} from '../state/types';

const createContext: CreateGameContext = {
  roomCode: 'WIN001',
  hostUserId: 'user-0',
  nowMs: 1_000,
  commandId: 'create-win',
};

function context(userId: string, nowMs: number): CommandContext {
  return {
    nowMs,
    commandId: `victory:${userId}:${nowMs}`,
    randomSeed: `victory-seed:${userId}:${nowMs}`,
    actor: { kind: 'user', userId },
    controlledSeat: null,
  };
}

function dispatch(
  state: FashionState,
  command: FashionCommand,
  actor: CommandContext,
): FashionState {
  const decision = fashionEngine.decide(state, command, actor);
  if (decision.kind === 'reject') throw new Error(decision.reason);
  let next = state;
  for (const event of decision.events) next = fashionEngine.evolve(next, event);
  return fashionEngine.normalize(next);
}

function createStartedState(): FashionState {
  let state = fashionEngine.createInitialState({ numberOfPlayers: 7 }, createContext);
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    state = dispatch(
      state,
      { type: 'room.seat.take', seat, profile: { displayName: `Player ${seat}` } },
      context(`user-${seat}`, 2_000 + seat),
    );
  }
  return dispatch(state, { type: 'fashion.game.start' }, context('user-0', 3_000));
}

function seatForRole(state: FashionState, roleId: FashionRoleId): number {
  const entry = Object.entries(state.roles).find(([, role]) => role === roleId);
  if (entry === undefined) throw new Error(`Expected role ${roleId}`);
  return Number(entry[0]);
}

function votesTargeting(targetSeat: number): Readonly<Record<number, number>> {
  return Object.fromEntries(
    Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => [seat, targetSeat]),
  );
}

function convictionState(base: FashionState): FashionState {
  const villainSeat = seatForRole(base, 'villainProcurementDirector');
  return {
    ...base,
    publicEvidence: ['V1', 'V2'],
    finalVotes: votesTargeting(villainSeat),
  };
}

function acquittalState(base: FashionState): FashionState {
  const villainSeat = seatForRole(base, 'villainProcurementDirector');
  const targetSeat = Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => seat).find(
    (seat) => seat !== villainSeat,
  );
  if (targetSeat === undefined) throw new Error('Expected non-villain seat');
  return {
    ...base,
    publicEvidence: ['V1', 'V2'],
    finalVotes: votesTargeting(targetSeat),
  };
}

function history(
  seat: number,
  votes: readonly FashionInvestigationVote[],
): FashionState['investigationVoteHistory'] {
  return votes.map((vote, index) => ({ round: (index + 1) as 1 | 2 | 3 | 4, seat, vote }));
}

function winners(state: FashionState): readonly number[] {
  return evaluateFashionVictory(state).winners;
}

describe('Fashion Shadow government official victory', () => {
  it('wins when approve is the majority and the villain is convicted', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'governmentOfficial');
    const state = convictionState({
      ...base,
      investigationVoteHistory: history(seat, ['approve', 'approve', 'approve', 'reject']),
    });
    expect(winners(state)).toContain(seat);
  });

  it('wins when reject is the majority and the villain is acquitted', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'governmentOfficial');
    const state = acquittalState({
      ...base,
      investigationVoteHistory: history(seat, ['reject', 'approve', 'reject', 'reject']),
    });
    expect(winners(state)).toContain(seat);
  });

  it('uses the official final-hearing accusation as the 2:2 tie-break', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'governmentOfficial');
    const villainSeat = seatForRole(base, 'villainProcurementDirector');
    const state = convictionState({
      ...base,
      investigationVoteHistory: history(seat, ['approve', 'reject', 'approve', 'reject']),
      finalVotes: { ...votesTargeting(villainSeat), [seat]: villainSeat },
    });
    expect(winners(state)).toContain(seat);
  });

  it('loses when the inspection-favor secret was revealed', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'governmentOfficial');
    const secret = base.secrets[seat];
    if (secret === undefined) throw new Error('Expected government secret');
    const state = convictionState({
      ...base,
      investigationVoteHistory: history(seat, ['approve', 'approve', 'approve', 'reject']),
      revealedSecrets: { [seat]: secret },
    });
    expect(winners(state)).not.toContain(seat);
  });
});

describe('Fashion Shadow consumer representative victory', () => {
  it('wins with a cross-examination award while the sponsorship secret stays private', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'consumerRepresentative');
    const state = { ...convictionState(base), crossExamAwards: [{ round: 1 as const, seat }] };
    expect(winners(state)).toContain(seat);
  });

  it('loses without a cross-examination award', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'consumerRepresentative');
    expect(winners(convictionState(base))).not.toContain(seat);
  });

  it('loses when the sponsorship secret was revealed', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'consumerRepresentative');
    const secret = base.secrets[seat];
    if (secret === undefined) throw new Error('Expected consumer secret');
    const state = {
      ...convictionState(base),
      crossExamAwards: [{ round: 1 as const, seat }],
      revealedSecrets: { [seat]: secret },
    };
    expect(winners(state)).not.toContain(seat);
  });
});

describe('Fashion Shadow factory worker contract settlement', () => {
  it('wins when a fulfilled-contract buyer wins', () => {
    const base = createStartedState();
    const workerSeat = seatForRole(base, 'factoryWorker');
    const buyerSeat = seatForRole(base, 'journalist');
    const state = convictionState({
      ...base,
      contracts: [
        {
          id: 'contract-win',
          sellerSeat: workerSeat,
          buyerSeat,
          promise: 'protection',
          status: 'fulfilled',
        },
      ],
    });
    expect(winners(state)).toContain(workerSeat);
  });

  it('loses when the fulfilled-contract buyer loses', () => {
    const base = createStartedState();
    const workerSeat = seatForRole(base, 'factoryWorker');
    const buyerSeat = seatForRole(base, 'villainProcurementDirector');
    const state = convictionState({
      ...base,
      contracts: [
        {
          id: 'contract-lose',
          sellerSeat: workerSeat,
          buyerSeat,
          promise: 'compensation',
          status: 'fulfilled',
        },
      ],
    });
    expect(winners(state)).not.toContain(workerSeat);
  });

  it('does not settle an accepted but unfulfilled contract', () => {
    const base = createStartedState();
    const workerSeat = seatForRole(base, 'factoryWorker');
    const buyerSeat = seatForRole(base, 'journalist');
    const state = convictionState({
      ...base,
      contracts: [
        {
          id: 'contract-accepted',
          sellerSeat: workerSeat,
          buyerSeat,
          promise: 'protection',
          status: 'accepted',
        },
      ],
    });
    expect(winners(state)).not.toContain(workerSeat);
  });

  it('does not settle a proposed-only contract', () => {
    const base = createStartedState();
    const workerSeat = seatForRole(base, 'factoryWorker');
    const buyerSeat = seatForRole(base, 'journalist');
    const state = convictionState({
      ...base,
      contracts: [
        {
          id: 'contract-proposed',
          sellerSeat: workerSeat,
          buyerSeat,
          promise: 'legalImmunity',
          status: 'proposed',
        },
      ],
    });
    expect(winners(state)).not.toContain(workerSeat);
  });
});

describe('Fashion Shadow brand executive victory', () => {
  it('loses when public evidence directly implicates the brand executive', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'brandExecutive');
    expect(winners(convictionState(base))).not.toContain(seat);
  });

  it('wins when the villain is convicted without public evidence implicating the brand executive', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'brandExecutive');
    const villainSeat = seatForRole(base, 'villainProcurementDirector');
    const state: FashionState = {
      ...base,
      publicEvidence: ['V2', 'V3'],
      finalVotes: votesTargeting(villainSeat),
    };
    expect(winners(state)).toContain(seat);
  });
});

describe('Fashion Shadow supplier owner victory', () => {
  it('wins when the last investigation vote matches the final result', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'supplierOwner');
    const state = convictionState({
      ...base,
      investigationVoteHistory: [{ round: 4, seat, vote: 'approve' }],
    });
    expect(winners(state)).toContain(seat);
  });

  it('loses when the last investigation vote mismatches the final result', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'supplierOwner');
    const state = convictionState({
      ...base,
      investigationVoteHistory: [{ round: 4, seat, vote: 'reject' }],
    });
    expect(winners(state)).not.toContain(seat);
  });

  it('loses when the breach secret was revealed', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'supplierOwner');
    const secret = base.secrets[seat];
    if (secret === undefined) throw new Error('Expected supplier secret');
    const state = convictionState({
      ...base,
      investigationVoteHistory: [{ round: 4, seat, vote: 'approve' }],
      revealedSecrets: { [seat]: secret },
    });
    expect(winners(state)).not.toContain(seat);
  });
});

describe('Fashion Shadow journalist and villain victory', () => {
  it('journalist wins on conviction with at least two public evidence cards', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'journalist');
    expect(winners(convictionState(base))).toContain(seat);
  });

  it('journalist loses when fewer than two evidence cards are public', () => {
    const base = createStartedState();
    const journalistSeat = seatForRole(base, 'journalist');
    const villainSeat = seatForRole(base, 'villainProcurementDirector');
    const state = {
      ...base,
      publicEvidence: ['V1'] as const,
      finalVotes: votesTargeting(villainSeat),
    };
    expect(winners(state)).not.toContain(journalistSeat);
  });

  it('villain loses on conviction', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'villainProcurementDirector');
    expect(winners(convictionState(base))).not.toContain(seat);
  });

  it('villain wins on acquittal', () => {
    const base = createStartedState();
    const seat = seatForRole(base, 'villainProcurementDirector');
    expect(winners(acquittalState(base))).toContain(seat);
  });
});
