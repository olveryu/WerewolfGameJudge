// Privacy boundary tests for Fashion Shadow client projections.

import type { CommandContext, CreateGameContext } from '../../../platform/engine';
import type { FashionCommand } from '../commands/types';
import { getFashionPublicState } from '../domain/visibility';
import { fashionEngine } from '../engine';
import { FASHION_PUBLIC_STATE_CODEC } from '../state/publicCodec';
import { FASHION_PLAYER_COUNT, type FashionState } from '../state/types';

const createContext: CreateGameContext = {
  roomCode: 'SAFE01',
  hostUserId: 'user-0',
  nowMs: 1,
  commandId: 'create-safe',
};

function context(userId: string, nowMs: number): CommandContext {
  return {
    nowMs,
    commandId: `privacy:${userId}:${nowMs}`,
    randomSeed: `privacy-seed:${userId}:${nowMs}`,
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
      context(`user-${seat}`, 10 + seat),
    );
  }
  return dispatch(state, { type: 'fashion.game.start' }, context('user-0', 100));
}

describe('Fashion Shadow visibility', () => {
  it('exposes exactly one private identity to each seated user', () => {
    const state = createStartedState();
    const first = getFashionPublicState(state, 'user-0');
    const second = getFashionPublicState(state, 'user-1');

    expect(first.privateIdentity?.seat).toBe(0);
    expect(second.privateIdentity?.seat).toBe(1);
    expect(first.privateIdentity?.roleId).toBe(state.roles[0]);
    expect(second.privateIdentity?.roleId).toBe(state.roles[1]);
    expect(first.privateIdentity?.secretId).toBe(state.secrets[0]);
    expect(second.privateIdentity?.secretId).toBe(state.secrets[1]);
    expect(first.privateIdentity).not.toEqual(second.privateIdentity);
  });

  it('redacts private maps while exposing only explicitly revealed secrets', () => {
    const base = createStartedState();
    const workerEntry = Object.entries(base.roles).find(([, role]) => role === 'factoryWorker');
    if (workerEntry === undefined) throw new Error('Expected factory worker');
    const workerSeat = Number(workerEntry[0]);
    const buyerSeat = workerSeat === 0 ? 1 : 0;
    const revealedSeat = buyerSeat;
    const revealedSecret = base.secrets[revealedSeat];
    if (revealedSecret === undefined) throw new Error('Expected revealed secret');
    const state: FashionState = {
      ...base,
      contracts: [
        {
          id: 'private-contract',
          sellerSeat: workerSeat,
          buyerSeat,
          promise: 'protection',
          status: 'accepted',
        },
      ],
      investigationVoteHistory: [{ round: 1, seat: 0, vote: 'approve' }],
      finalVotes: { 0: buyerSeat },
      revealedSecrets: { [revealedSeat]: revealedSecret },
    };

    const projected = getFashionPublicState(state, 'user-0');
    expect('roles' in projected).toBe(false);
    expect('secrets' in projected).toBe(false);
    expect('votes' in projected).toBe(false);
    expect('finalVotes' in projected).toBe(false);
    expect('investigationVoteHistory' in projected).toBe(false);
    expect('contracts' in projected).toBe(false);
    expect(projected.revealedSecrets).toEqual({ [revealedSeat]: revealedSecret });
    expect(FASHION_PUBLIC_STATE_CODEC.parse(projected)).toEqual(projected);
  });

  it('gives spectators no private identity', () => {
    const projected = getFashionPublicState(createStartedState(), null);
    expect(projected.privateIdentity).toBeNull();
  });

  it('does not expose identity-guess history or contract state', () => {
    const projected = getFashionPublicState(createStartedState(), 'user-0');
    expect('identityGuessHistory' in projected).toBe(false);
    expect('identityGuessPenalties' in projected).toBe(false);
    expect('contracts' in projected).toBe(false);
  });

  it('exposes an identity-guess result only to the player who made that guess', () => {
    const base = createStartedState();
    const state: FashionState = {
      ...base,
      phase: 'vote',
      identityGuessHistory: [
        {
          guesserSeat: 0,
          targetSeat: 1,
          round: 1,
          guessedRoleId: 'journalist',
          success: false,
        },
      ],
      identityGuessPenalties: [{ seat: 0, blockedRound: 2 }],
    };

    const guesser = getFashionPublicState(state, 'user-0');
    const target = getFashionPublicState(state, 'user-1');
    const spectator = getFashionPublicState(state, null);

    expect(guesser.myIdentityGuessResult).toEqual({
      targetSeat: 1,
      guessedRoleId: 'journalist',
      success: false,
      blockedNextRound: true,
    });
    expect(target.myIdentityGuessResult).toBeNull();
    expect(spectator.myIdentityGuessResult).toBeNull();
    expect(FASHION_PUBLIC_STATE_CODEC.parse(guesser)).toEqual(guesser);
  });
});
