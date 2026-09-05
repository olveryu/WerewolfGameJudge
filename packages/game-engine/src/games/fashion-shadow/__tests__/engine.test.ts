// First-round vertical-slice tests for Fashion Shadow.

import type { CommandContext, CreateGameContext } from '../../../platform/engine';
import type { FashionCommand } from '../commands/types';
import { FASHION_ROUND_BY_NUMBER } from '../domain/content';
import {
  REASON_FASHION_CROSS_EXAM_NOT_FINISHED,
  REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT,
  REASON_FASHION_IDENTITY_GUESS_TARGET_REPEATED,
  REASON_FASHION_VOTES_INCOMPLETE,
} from '../domain/reasons';
import { fashionEngine } from '../engine';
import {
  FASHION_CROSS_EXAM_DURATION_MS,
  FASHION_INITIAL_ACTION_TOKENS,
  FASHION_PLAYER_COUNT,
  type FashionState,
} from '../state/types';

const createContext: CreateGameContext = {
  roomCode: 'FASH01',
  hostUserId: 'user-0',
  nowMs: 1_000,
  commandId: 'create-1',
};

function userContext(userId: string, nowMs = 2_000): CommandContext {
  return {
    nowMs,
    commandId: `command:${userId}:${nowMs}`,
    randomSeed: `seed:${userId}:${nowMs}`,
    actor: { kind: 'user', userId },
    controlledSeat: null,
  };
}

function dispatch(
  state: FashionState,
  command: FashionCommand,
  context: CommandContext,
): FashionState {
  const decision = fashionEngine.decide(state, command, context);
  if (decision.kind === 'reject') throw new Error(`Unexpected rejection: ${decision.reason}`);
  let next = state;
  for (const event of decision.events) next = fashionEngine.evolve(next, event);
  return fashionEngine.normalize(next);
}

function expectReject(
  state: FashionState,
  command: FashionCommand,
  context: CommandContext,
): string {
  const decision = fashionEngine.decide(state, command, context);
  if (decision.kind !== 'reject') throw new Error('Expected command rejection');
  return decision.reason;
}

function createFullLobby(): FashionState {
  let state = fashionEngine.createInitialState({ numberOfPlayers: 7 }, createContext);
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    state = dispatch(
      state,
      {
        type: 'room.seat.take',
        seat,
        profile: { displayName: `Player ${seat}` },
      },
      userContext(`user-${seat}`, 2_000 + seat),
    );
  }
  return state;
}

function startAndConfirmRoles(): FashionState {
  let state = dispatch(
    createFullLobby(),
    { type: 'fashion.game.start' },
    userContext('user-0', 3_000),
  );
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    state = dispatch(
      state,
      { type: 'fashion.role.confirm' },
      userContext(`user-${seat}`, 3_100 + seat),
    );
  }
  return state;
}

function advanceToVote(): FashionState {
  let state = startAndConfirmRoles();
  state = dispatch(state, { type: 'fashion.event.reveal' }, userContext('user-0', 4_000));
  state = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', 5_000));
  state = dispatch(
    state,
    { type: 'fashion.crossExam.finish' },
    userContext('user-0', 5_000 + FASHION_CROSS_EXAM_DURATION_MS),
  );
  return dispatch(
    state,
    { type: 'fashion.discussion.finish' },
    userContext('user-0', 190_100),
  );
}

function castVotes(state: FashionState, approveCount: number, nowMs: number): FashionState {
  let next = state;
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    next = dispatch(
      next,
      { type: 'fashion.vote.cast', vote: seat < approveCount ? 'approve' : 'reject' },
      userContext(`user-${seat}`, nowMs + seat),
    );
  }
  return next;
}

function finishVoteRound(state: FashionState, nowMs: number): FashionState {
  return dispatch(state, { type: 'fashion.vote.finish' }, userContext('user-0', nowMs));
}

function playRoundToTransition(state: FashionState, baseMs: number): FashionState {
  let next = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', baseMs));
  next = dispatch(
    next,
    { type: 'fashion.crossExam.finish' },
    userContext('user-0', baseMs + FASHION_CROSS_EXAM_DURATION_MS),
  );
  next = dispatch(
    next,
    { type: 'fashion.discussion.finish' },
    userContext('user-0', baseMs + FASHION_CROSS_EXAM_DURATION_MS + 10_000),
  );
  next = castVotes(next, 4, baseMs + FASHION_CROSS_EXAM_DURATION_MS + 100_000);
  return finishVoteRound(next, baseMs + FASHION_CROSS_EXAM_DURATION_MS + 100_000 + FASHION_PLAYER_COUNT);
}

describe('Fashion Shadow contracts', () => {
  it('allows a worker to propose, accept, and fulfill a secret contract', () => {
    let state = startAndConfirmRoles();
    const buyerSeat = 1;
    state = dispatch(
      state,
      {
        type: 'fashion.contract.propose',
        contractId: 'contract-1',
        buyerSeat,
        promise: 'protection',
      },
      userContext('user-0', 4_000),
    );
    expect(state.contracts[0]).toEqual({
      id: 'contract-1',
      sellerSeat: 0,
      buyerSeat,
      promise: 'protection',
      status: 'proposed',
    });
    state = dispatch(
      state,
      { type: 'fashion.contract.accept', contractId: 'contract-1' },
      userContext('user-1', 4_100),
    );
    state = dispatch(
      state,
      { type: 'fashion.contract.fulfill', contractId: 'contract-1' },
      userContext('user-0', 4_200),
    );
    expect(state.contracts[0]?.status).toBe('fulfilled');
  });
});

describe('Fashion Shadow identity guess', () => {
  it('reveals a secret and consumes a token on a correct identity guess', () => {
    let state = startAndConfirmRoles();
    const targetSeat = 1;
    const guessedSecretId = state.secrets[targetSeat];
    if (guessedSecretId === undefined) throw new Error('Expected target secret');

    const before = state.actionTokens[0];
    if (before === undefined) throw new Error('Expected seat 0 action tokens');

    state = dispatch(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedSecretId },
      userContext('user-0', 4_500),
    );

    expect(state.revealedSecrets[targetSeat]).toBe(guessedSecretId);
    expect(state.actionTokens[0]).toBe(before - 1);
    expect(state.identityGuessPenalties).toEqual([]);
  });

  it('records a blocked round after an incorrect identity guess', () => {
    let state = startAndConfirmRoles();
    const targetSeat = 1;
    const targetSecret = state.secrets[targetSeat];
    if (targetSecret === undefined) throw new Error('Expected target secret');
    const wrongSecret = Object.values(state.secrets).find((secret) => secret !== targetSecret);
    if (wrongSecret === undefined) throw new Error('Expected wrong secret');

    state = dispatch(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedSecretId: wrongSecret },
      userContext('user-0', 4_500),
    );

    expect(state.revealedSecrets[targetSeat]).toBeUndefined();
    expect(state.identityGuessPenalties).toContainEqual({ seat: 0, blockedRound: 1 });
  });

  it('rejects a second identity guess within the same round', () => {
    let state = startAndConfirmRoles();
    const targetSeat = 1;
    const secret = state.secrets[targetSeat];
    if (secret === undefined) throw new Error('Expected target secret');

    state = dispatch(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedSecretId: secret },
      userContext('user-0', 4_500),
    );

    const reason = expectReject(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat: 2, guessedSecretId: secret },
      userContext('user-0', 4_600),
    );
    expect(reason).toBe(REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT);
  });

  it('rejects guessing the same target in consecutive guesses', () => {
    const base = startAndConfirmRoles();
    const targetSeat = 1;
    const secret = base.secrets[targetSeat];
    if (secret === undefined) throw new Error('Expected target secret');

    const state: FashionState = {
      ...base,
      currentRound: 2,
      identityGuessHistory: [{ guesserSeat: 0, targetSeat, round: 1 }],
    };

    const reason = expectReject(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedSecretId: secret },
      userContext('user-0', 5_500),
    );
    expect(reason).toBe(REASON_FASHION_IDENTITY_GUESS_TARGET_REPEATED);
  });
});

describe('Fashion Shadow round-one vertical slice', () => {
  it('assigns all seven roles and three action tokens per player', () => {
    const state = dispatch(
      createFullLobby(),
      { type: 'fashion.game.start' },
      userContext('user-0', 3_000),
    );
    expect(state.phase).toBe('roleReveal');
    expect(fashionEngine.getLifecycle(state)).toBe('ongoing');
    expect(new Set(Object.values(state.roles)).size).toBe(FASHION_PLAYER_COUNT);
    expect(Object.values(state.actionTokens)).toEqual(
      Array.from({ length: FASHION_PLAYER_COUNT }, () => FASHION_INITIAL_ACTION_TOKENS),
    );
  });

  it('runs E1 cross-examination as factory worker versus brand executive for three minutes', () => {
    let state = startAndConfirmRoles();
    state = dispatch(state, { type: 'fashion.event.reveal' }, userContext('user-0', 4_000));
    expect(state.currentEvent).toBe('E1');
    state = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', 5_000));

    const workerEntry = Object.entries(state.roles).find(([, roleId]) => roleId === 'factoryWorker');
    const brandEntry = Object.entries(state.roles).find(([, roleId]) => roleId === 'brandExecutive');
    if (workerEntry === undefined || brandEntry === undefined) {
      throw new Error('Expected worker and brand roles');
    }
    const workerSeat = Number(workerEntry[0]);
    const brandSeat = Number(brandEntry[0]);
    expect(state.interrogation).toEqual({
      attackerSeat: workerSeat,
      defenderSeat: brandSeat,
      startedAt: 5_000,
      endsAt: 5_000 + FASHION_CROSS_EXAM_DURATION_MS,
    });
    expect(state.actionTokens[workerSeat]).toBe(FASHION_INITIAL_ACTION_TOKENS - 1);
    expect(state.actionTokens[brandSeat]).toBe(FASHION_INITIAL_ACTION_TOKENS - 1);
    expect(
      fashionEngine.decide(
        state,
        { type: 'fashion.crossExam.finish' },
        userContext('user-0', 5_000 + FASHION_CROSS_EXAM_DURATION_MS - 1),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FASHION_CROSS_EXAM_NOT_FINISHED });
  });

  it('publishes V1 when four of seven players approve', () => {
    let state = advanceToVote();
    expect(
      fashionEngine.decide(state, { type: 'fashion.vote.finish' }, userContext('user-0', 190_200)),
    ).toEqual({ kind: 'reject', reason: REASON_FASHION_VOTES_INCOMPLETE });

    for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
      state = dispatch(
        state,
        { type: 'fashion.vote.cast', vote: seat < 4 ? 'approve' : 'reject' },
        userContext(`user-${seat}`, 191_000 + seat),
      );
    }
    state = dispatch(state, { type: 'fashion.vote.finish' }, userContext('user-0', 192_000));
    expect(state.phase).toBe('roundTransition');
    expect(state.publicEvidence).toEqual([FASHION_ROUND_BY_NUMBER[1].evidenceId]);
    expect(state.destroyedEvidence).toEqual([]);
  });

  it('advances through all four rounds using configured events', () => {
    // 第 1 轮投票结束，进入 roundTransition
    let state = castVotes(advanceToVote(), 4, 191_000);
    state = finishVoteRound(state, 192_000);
    expect(state.phase).toBe('roundTransition');

    // 后续每轮：round.advance 只允许在 roundTransition 发起（引擎相位机），
    // 推进后需走完本轮 crossExam → discussion → 投票 才能再次推进。
    let nowMs = 500_000;
    for (const round of [2, 3, 4] as const) {
      nowMs += FASHION_CROSS_EXAM_DURATION_MS + 200_000;
      state = dispatch(
        state,
        { type: 'fashion.round.advance' },
        userContext('user-0', nowMs),
      );
      expect(state.currentRound).toBe(round);
      expect(state.currentEvent).toBe(FASHION_ROUND_BY_NUMBER[round].eventId);
      expect(state.phase).toBe('event');

      if (round < 4) {
        nowMs += 1_000;
        state = playRoundToTransition(state, nowMs);
        expect(state.phase).toBe('roundTransition');
      }
    }
  });

  it('destroys V1 when only three of seven players approve', () => {
    let state = advanceToVote();
    for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
      state = dispatch(
        state,
        { type: 'fashion.vote.cast', vote: seat < 3 ? 'approve' : 'reject' },
        userContext(`user-${seat}`, 191_000 + seat),
      );
    }
    state = dispatch(state, { type: 'fashion.vote.finish' }, userContext('user-0', 192_000));
    expect(state.publicEvidence).toEqual([]);
    expect(state.destroyedEvidence).toEqual(['V1']);
  });
});

describe('Fashion Shadow identity guess', () => {
  it('reveals the target secret and consumes a token on a successful guess', () => {
    let state = startAndConfirmRoles();
    state = dispatch(
      state,
      {
        type: 'fashion.identityGuess.cast',
        targetSeat: 1,
        guessedSecretId: state.secrets[1]!,
      },
      userContext('user-0', 4_000),
    );

    expect(state.revealedSecrets[1]).toBe(state.secrets[1]);
    expect(state.actionTokens[0]).toBe(FASHION_INITIAL_ACTION_TOKENS - 1);
  });

  it('blocks the guesser from cross examination after a failed guess', () => {
    let state = startAndConfirmRoles();
    const wrongSecret = Object.values(state.secrets).find(
      (secret) => secret !== state.secrets[1],
    );
    if (wrongSecret === undefined) throw new Error('Expected another secret');

    state = dispatch(
      state,
      {
        type: 'fashion.identityGuess.cast',
        targetSeat: 1,
        guessedSecretId: wrongSecret,
      },
      userContext('user-0', 4_000),
    );

    expect(state.revealedSecrets[1]).toBeUndefined();
    expect(state.identityGuessPenalties).toContainEqual({
      seat: 0,
      blockedRound: state.currentRound,
    });
  });
});

describe('Fashion Shadow final hearing', () => {
  it('uses VictoryEvaluator instead of raw highest vote', () => {
    const state: FashionState = {
      ...startAndConfirmRoles(),
      phase: 'hearing',
      finalVotes: {
        0: 1,
        1: 1,
        2: 1,
      },
    };

    const decision = fashionEngine.decide(
      state,
      { type: 'fashion.hearing.finish' },
      userContext('user-0', 9_000),
    );

    if (decision.kind === 'reject') throw new Error(decision.reason);
    const next = decision.events.reduce<FashionState>(
      (current, event) => fashionEngine.evolve(current, event),
      state,
    );

    const villainSeat = Number(
      Object.entries(state.roles).find(([, role]) => role === 'villainProcurementDirector')?.[0],
    );
    expect(next.winners).toContain(villainSeat);
  });
});
