// Authoritative multiplayer and solo-experience tests for Fashion Shadow.

import type { CommandContext, CreateGameContext } from '../../../platform/engine';
import type { FashionCommand } from '../commands/types';
import { FASHION_ROUND_BY_NUMBER } from '../domain/content';
import {
  REASON_FASHION_CROSS_EXAM_AWARD_ALREADY_SET,
  REASON_FASHION_CROSS_EXAM_AWARD_INVALID,
  REASON_FASHION_CROSS_EXAM_EVIDENCE_UNAVAILABLE,
  REASON_FASHION_CROSS_EXAM_NOT_FINISHED,
  REASON_FASHION_CROSS_EXAM_STATEMENT_CLOSED,
  REASON_FASHION_CROSS_EXAM_STATEMENT_INVALID,
  REASON_FASHION_CROSS_EXAM_STATEMENT_LIMIT_REACHED,
  REASON_FASHION_CROSS_EXAM_STATEMENT_NOT_PARTICIPANT,
  REASON_FASHION_DISCUSSION_LIMIT_REACHED,
  REASON_FASHION_DISCUSSION_MESSAGE_INVALID,
  REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT,
  REASON_FASHION_IDENTITY_GUESS_TARGET_REPEATED,
  REASON_FASHION_PHASE_INVALID,
  REASON_FASHION_VOTES_INCOMPLETE,
} from '../domain/reasons';
import { fashionEngine } from '../engine';
import {
  FASHION_CONTRACT_ID_MAX_LENGTH,
  FASHION_CROSS_EXAM_DURATION_MS,
  FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH,
  FASHION_DISCUSSION_MESSAGE_MAX_LENGTH,
  FASHION_INITIAL_ACTION_TOKENS,
  FASHION_MAX_CROSS_EXAM_STATEMENTS_PER_MATCH,
  FASHION_PLAYER_COUNT,
  type FashionState,
  isFashionBotUserId,
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

function createSoloLobby(): FashionState {
  let state = fashionEngine.createInitialState({ numberOfPlayers: 7 }, createContext);
  state = dispatch(
    state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: 'Solo Player' } },
    userContext('user-0', 2_000),
  );
  return dispatch(state, { type: 'room.seat.fillBots' }, userContext('user-0', 2_100));
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
  state = dispatch(
    state,
    { type: 'fashion.crossExam.finish' },
    userContext('user-0', 5_000 + FASHION_CROSS_EXAM_DURATION_MS * 2),
  );
  const candidateSeat = state.crossExamParticipantSeats[0];
  if (candidateSeat === undefined) throw new Error('Expected cross exam participant');
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    state = dispatch(
      state,
      { type: 'fashion.crossExam.award', seat: candidateSeat },
      userContext(`user-${seat}`, 5_100 + FASHION_CROSS_EXAM_DURATION_MS * 2 + seat),
    );
  }
  return dispatch(
    state,
    { type: 'fashion.discussion.finish' },
    userContext('user-0', 5_200 + FASHION_CROSS_EXAM_DURATION_MS * 2),
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
    { type: 'fashion.crossExam.finish' },
    userContext('user-0', baseMs + FASHION_CROSS_EXAM_DURATION_MS * 2),
  );
  const candidateSeat = next.crossExamParticipantSeats[0];
  if (candidateSeat === undefined) throw new Error('Expected cross exam participant');
  for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
    next = dispatch(
      next,
      { type: 'fashion.crossExam.award', seat: candidateSeat },
      userContext(`user-${seat}`, baseMs + FASHION_CROSS_EXAM_DURATION_MS * 2 + 100 + seat),
    );
  }
  next = dispatch(
    next,
    { type: 'fashion.discussion.finish' },
    userContext('user-0', baseMs + FASHION_CROSS_EXAM_DURATION_MS * 2 + 10_000),
  );
  next = castVotes(next, 4, baseMs + FASHION_CROSS_EXAM_DURATION_MS * 2 + 100_000);
  return finishVoteRound(
    next,
    baseMs + FASHION_CROSS_EXAM_DURATION_MS * 2 + 100_000 + FASHION_PLAYER_COUNT,
  );
}

describe('Fashion Shadow discussion', () => {
  function advanceToDiscussion(): FashionState {
    let state = startAndConfirmRoles();
    state = dispatch(state, { type: 'fashion.event.reveal' }, userContext('user-0', 20_000));
    state = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', 21_000));
    state = dispatch(
      state,
      { type: 'fashion.crossExam.finish' },
      userContext('user-0', 21_000 + FASHION_CROSS_EXAM_DURATION_MS),
    );
    return dispatch(
      state,
      { type: 'fashion.crossExam.finish' },
      userContext('user-0', 21_000 + FASHION_CROSS_EXAM_DURATION_MS * 2),
    );
  }

  it('stores trimmed public discussion messages and consumes one token per message', () => {
    let state = advanceToDiscussion();
    const speakerSeat = Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => seat).find(
      (seat) => !state.crossExamParticipantSeats.includes(seat),
    );
    if (speakerSeat === undefined) throw new Error('Expected a non-participant discussion speaker');
    const beforeTokens = state.actionTokens[speakerSeat];
    if (beforeTokens === undefined) throw new Error('Expected discussion speaker tokens');

    state = dispatch(
      state,
      { type: 'fashion.discussion.speak', message: '  我认为采购记录和标签更换有关。  ' },
      userContext(`user-${speakerSeat}`, 500_000),
    );

    expect(state.actionTokens[speakerSeat]).toBe(beforeTokens - 1);
    expect(state.discussionSpeakCounts[speakerSeat]).toBe(1);
    expect(state.discussionMessages).toEqual([
      {
        round: 1,
        seat: speakerSeat,
        message: '我认为采购记录和标签更换有关。',
        createdAt: 500_000,
      },
    ]);
  });

  it('rejects empty, oversized, and third discussion messages', () => {
    let state = advanceToDiscussion();
    const speakerSeat = Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => seat).find(
      (seat) => !state.crossExamParticipantSeats.includes(seat),
    );
    if (speakerSeat === undefined) throw new Error('Expected a non-participant discussion speaker');
    const actor = userContext(`user-${speakerSeat}`, 600_000);

    expect(expectReject(state, { type: 'fashion.discussion.speak', message: '   ' }, actor)).toBe(
      REASON_FASHION_DISCUSSION_MESSAGE_INVALID,
    );
    expect(
      expectReject(
        state,
        {
          type: 'fashion.discussion.speak',
          message: '证'.repeat(FASHION_DISCUSSION_MESSAGE_MAX_LENGTH + 1),
        },
        actor,
      ),
    ).toBe(REASON_FASHION_DISCUSSION_MESSAGE_INVALID);

    state = dispatch(
      state,
      { type: 'fashion.discussion.speak', message: '第一条公开论点' },
      userContext(`user-${speakerSeat}`, 600_001),
    );
    state = dispatch(
      state,
      { type: 'fashion.discussion.speak', message: '第二条公开论点' },
      userContext(`user-${speakerSeat}`, 600_002),
    );
    expect(
      expectReject(
        state,
        { type: 'fashion.discussion.speak', message: '第三条不应被接受' },
        userContext(`user-${speakerSeat}`, 600_003),
      ),
    ).toBe(REASON_FASHION_DISCUSSION_LIMIT_REACHED);
  });
});

describe('Fashion Shadow restart', () => {
  it('starts a clean new case in the same occupied room after settlement', () => {
    const base = startAndConfirmRoles();
    const ended: FashionState = {
      ...base,
      phase: 'ended',
      currentRound: 4,
      currentEvent: 'E4',
      publicEvidence: ['V1'],
      destroyedEvidence: ['V2'],
      investigationVoteHistory: [{ round: 1, seat: 0, vote: 'approve' }],
      discussionMessages: [{ round: 1, seat: 0, message: '旧案件公开论点', createdAt: 700_000 }],
      crossExamStatements: [
        {
          round: 1,
          match: 1,
          seat: 0,
          side: 'attacker',
          message: '旧案件质询论点',
          evidenceId: 'V1',
          createdAt: 699_000,
        },
      ],
      winners: [0],
    };

    const restarted = dispatch(
      ended,
      { type: 'fashion.game.restart' },
      userContext('user-0', 700_100),
    );

    expect(restarted.phase).toBe('roleReveal');
    expect(restarted.currentRound).toBe(1);
    expect(restarted.currentEvent).toBeNull();
    expect(restarted.publicEvidence).toEqual([]);
    expect(restarted.destroyedEvidence).toEqual([]);
    expect(restarted.investigationVoteHistory).toEqual([]);
    expect(restarted.discussionMessages).toEqual([]);
    expect(restarted.crossExamStatements).toEqual([]);
    expect(restarted.contracts).toEqual([]);
    expect(restarted.revealedSecrets).toEqual({});
    expect(restarted.finalVotes).toEqual({});
    expect(restarted.winners).toEqual([]);
    expect(Object.keys(restarted.roles)).toHaveLength(FASHION_PLAYER_COUNT);
    expect(new Set(Object.values(restarted.roles)).size).toBe(FASHION_PLAYER_COUNT);
  });
});

describe('Fashion Shadow solo experience', () => {
  it('fills empty seats with six marked test players', () => {
    const state = createSoloLobby();
    expect(Object.keys(state.realSeats)).toHaveLength(FASHION_PLAYER_COUNT);
    expect(state.realSeats[0]?.userId).toBe('user-0');
    for (let seat = 1; seat < FASHION_PLAYER_COUNT; seat += 1) {
      const occupant = state.realSeats[seat];
      expect(occupant).toBeDefined();
      if (occupant === undefined) throw new Error(`Expected bot seat ${seat}`);
      expect(isFashionBotUserId(occupant.userId)).toBe(true);
      expect(occupant.profile.displayName).toBe(`测试玩家 ${seat + 1}`);
    }
  });

  it('auto-confirms bots and lets the human cast the decisive seventh investigation vote', () => {
    let state = dispatch(
      createSoloLobby(),
      { type: 'fashion.game.start' },
      userContext('user-0', 3_000),
    );
    expect(state.roleConfirmedSeats).toEqual([1, 2, 3, 4, 5, 6]);

    state = dispatch(state, { type: 'fashion.role.confirm' }, userContext('user-0', 3_100));
    state = dispatch(state, { type: 'fashion.event.reveal' }, userContext('user-0', 3_200));
    state = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', 3_300));
    state = dispatch(state, { type: 'fashion.crossExam.finish' }, userContext('user-0', 3_301));
    expect(state.interrogation?.match).toBe(2);
    state = dispatch(state, { type: 'fashion.crossExam.finish' }, userContext('user-0', 3_302));
    expect(Object.keys(state.crossExamAwardVotes)).toHaveLength(6);
    const candidateSeat = state.crossExamParticipantSeats[0];
    if (candidateSeat === undefined) throw new Error('Expected cross exam participant');
    state = dispatch(
      state,
      { type: 'fashion.crossExam.award', seat: candidateSeat },
      userContext('user-0', 3_350),
    );
    state = dispatch(state, { type: 'fashion.discussion.finish' }, userContext('user-0', 3_400));

    expect(Object.keys(state.votes)).toHaveLength(6);
    expect(Object.values(state.votes).filter((vote) => vote === 'approve')).toHaveLength(3);
    expect(Object.values(state.votes).filter((vote) => vote === 'reject')).toHaveLength(3);

    state = dispatch(
      state,
      { type: 'fashion.vote.cast', vote: 'approve' },
      userContext('user-0', 3_500),
    );
    expect(Object.keys(state.votes)).toHaveLength(FASHION_PLAYER_COUNT);
    state = dispatch(state, { type: 'fashion.vote.finish' }, userContext('user-0', 3_600));
    expect(state.publicEvidence).toContain('V1');
  });

  it('auto-submits six bot accusations while leaving the human vote decisive', () => {
    let state = dispatch(
      createSoloLobby(),
      { type: 'fashion.game.start' },
      userContext('user-0', 3_000),
    );
    state = dispatch(state, { type: 'fashion.role.confirm' }, userContext('user-0', 3_100));
    state = { ...state, currentRound: 4, phase: 'roundTransition' };

    state = dispatch(state, { type: 'fashion.hearing.start' }, userContext('user-0', 4_000));
    expect(Object.keys(state.finalVotes)).toHaveLength(6);
    expect(state.finalVotes[0]).toBeUndefined();
    for (let seat = 1; seat < FASHION_PLAYER_COUNT; seat += 1) {
      expect(state.finalVotes[seat]).toBe(seat);
    }

    state = dispatch(
      state,
      { type: 'fashion.hearing.vote', targetSeat: 6 },
      userContext('user-0', 4_100),
    );
    const accusationCounts = Object.values(state.finalVotes).reduce<Record<number, number>>(
      (counts, targetSeat) => ({
        ...counts,
        [targetSeat]: (counts[targetSeat] ?? 0) + 1,
      }),
      {},
    );
    expect(accusationCounts[6]).toBe(2);
    expect(Object.entries(accusationCounts).filter(([, count]) => count === 2)).toEqual([['6', 2]]);
  });
});

describe('Fashion Shadow contracts', () => {
  it('allows a worker to propose, accept, and fulfill a secret contract during free trading', () => {
    let state = finishVoteRound(castVotes(advanceToVote(), 4, 800_000), 800_100);
    const workerEntry = Object.entries(state.roles).find(([, role]) => role === 'factoryWorker');
    if (workerEntry === undefined) throw new Error('Expected factory worker');
    const workerSeat = Number(workerEntry[0]);
    const buyerSeat = workerSeat === 0 ? 1 : 0;
    const beforeTokens = state.actionTokens[workerSeat];
    state = dispatch(
      state,
      {
        type: 'fashion.contract.propose',
        contractId: 'contract-1',
        buyerSeat,
        promise: 'protection',
      },
      userContext(`user-${workerSeat}`, 4_000),
    );
    expect(state.actionTokens[workerSeat]).toBe((beforeTokens ?? 1) - 1);
    expect(state.contracts[0]).toEqual({
      id: 'contract-1',
      sellerSeat: workerSeat,
      buyerSeat,
      promise: 'protection',
      status: 'proposed',
    });
    state = dispatch(
      state,
      { type: 'fashion.contract.accept', contractId: 'contract-1' },
      userContext(`user-${buyerSeat}`, 4_100),
    );
    expect(
      expectReject(
        { ...state, phase: 'hearing' },
        { type: 'fashion.contract.fulfill', contractId: 'contract-1' },
        userContext(`user-${workerSeat}`, 4_150),
      ),
    ).toBe(REASON_FASHION_PHASE_INVALID);
    state = dispatch(
      state,
      { type: 'fashion.contract.fulfill', contractId: 'contract-1' },
      userContext(`user-${workerSeat}`, 4_200),
    );
    expect(state.contracts[0]?.status).toBe('fulfilled');
  });

  it('rejects an oversized contract id before it can enter persisted room state', () => {
    const state = finishVoteRound(castVotes(advanceToVote(), 4, 810_000), 810_100);
    const workerEntry = Object.entries(state.roles).find(([, role]) => role === 'factoryWorker');
    if (workerEntry === undefined) throw new Error('Expected factory worker');
    const workerSeat = Number(workerEntry[0]);
    const buyerSeat = workerSeat === 0 ? 1 : 0;

    expect(
      expectReject(
        state,
        {
          type: 'fashion.contract.propose',
          contractId: 'x'.repeat(FASHION_CONTRACT_ID_MAX_LENGTH + 1),
          buyerSeat,
          promise: 'protection',
        },
        userContext(`user-${workerSeat}`, 810_200),
      ),
    ).toBe(REASON_FASHION_PHASE_INVALID);
  });
});

describe('Fashion Shadow identity guess', () => {
  it('reveals a secret and consumes a token on a correct identity guess', () => {
    let state = advanceToVote();
    const targetSeat = 1;
    const targetRole = state.roles[targetSeat];
    const targetSecret = state.secrets[targetSeat];
    if (targetRole === undefined || targetSecret === undefined)
      throw new Error('Expected target identity');

    const before = state.actionTokens[0];
    if (before === undefined) throw new Error('Expected seat 0 action tokens');

    state = dispatch(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedRoleId: targetRole },
      userContext('user-0', 4_500),
    );

    expect(state.revealedSecrets[targetSeat]).toBe(targetSecret);
    expect(state.actionTokens[0]).toBe(before - 1);
    expect(state.identityGuessPenalties).toEqual([]);
  });

  it('records a blocked round after an incorrect identity guess', () => {
    let state = advanceToVote();
    const targetSeat = 1;
    const targetRole = state.roles[targetSeat];
    if (targetRole === undefined) throw new Error('Expected target role');
    const wrongRole = Object.values(state.roles).find((role) => role !== targetRole);
    if (wrongRole === undefined) throw new Error('Expected wrong role');

    state = dispatch(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedRoleId: wrongRole },
      userContext('user-0', 4_500),
    );

    expect(state.revealedSecrets[targetSeat]).toBeUndefined();
    expect(state.identityGuessPenalties).toContainEqual({ seat: 0, blockedRound: 2 });
  });

  it('rejects a second identity guess within the same round', () => {
    let state = advanceToVote();
    const targetSeat = 1;
    const role = state.roles[targetSeat];
    if (role === undefined) throw new Error('Expected target role');

    state = dispatch(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedRoleId: role },
      userContext('user-0', 4_500),
    );

    const reason = expectReject(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat: 2, guessedRoleId: role },
      userContext('user-0', 4_600),
    );
    expect(reason).toBe(REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT);
  });

  it('rejects guessing the same target in consecutive guesses', () => {
    const base = startAndConfirmRoles();
    const targetSeat = 1;
    const role = base.roles[targetSeat];
    if (role === undefined) throw new Error('Expected target role');

    const state: FashionState = {
      ...base,
      currentRound: 2,
      phase: 'vote',
      identityGuessHistory: [{ guesserSeat: 0, targetSeat, round: 1 }],
    };

    const reason = expectReject(
      state,
      { type: 'fashion.identityGuess.cast', targetSeat, guessedRoleId: role },
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

    const workerEntry = Object.entries(state.roles).find(
      ([, roleId]) => roleId === 'factoryWorker',
    );
    const brandEntry = Object.entries(state.roles).find(
      ([, roleId]) => roleId === 'brandExecutive',
    );
    if (workerEntry === undefined || brandEntry === undefined) {
      throw new Error('Expected worker and brand roles');
    }
    const workerSeat = Number(workerEntry[0]);
    const brandSeat = Number(brandEntry[0]);
    expect(state.interrogation).toEqual({
      match: 1,
      attackerSeat: workerSeat,
      defenderSeat: brandSeat,
      participantSeats: [workerSeat, brandSeat],
      startedAt: 5_000,
      endsAt: 5_000 + FASHION_CROSS_EXAM_DURATION_MS,
    });
    expect(state.actionTokens[workerSeat]).toBe(FASHION_INITIAL_ACTION_TOKENS - 1);
    expect(state.actionTokens[brandSeat]).toBe(FASHION_INITIAL_ACTION_TOKENS - 1);
    state = dispatch(
      state,
      { type: 'fashion.secret.revealSelf' },
      userContext(`user-${workerSeat}`, 5_100),
    );
    expect(state.revealedSecrets[workerSeat]).toBe(state.secrets[workerSeat]);
    expect(
      fashionEngine.decide(
        state,
        { type: 'fashion.crossExam.finish' },
        userContext('user-0', 5_000 + FASHION_CROSS_EXAM_DURATION_MS - 1),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FASHION_CROSS_EXAM_NOT_FINISHED });
  });

  it('records timed cross-exam statements with evidence citations and participant limits', () => {
    let state = startAndConfirmRoles();
    state = dispatch(state, { type: 'fashion.event.reveal' }, userContext('user-0', 4_000));
    state = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', 5_000));
    const interrogation = state.interrogation;
    if (interrogation === null) throw new Error('Expected active interrogation');
    const attackerSeat = interrogation.attackerSeat;
    const defenderSeat = interrogation.defenderSeat;
    const observerSeat = Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => seat).find(
      (seat) => !interrogation.participantSeats.includes(seat),
    );
    if (observerSeat === undefined) throw new Error('Expected observer seat');
    const beforeTokens = state.actionTokens[attackerSeat];

    state = dispatch(
      state,
      {
        type: 'fashion.crossExam.statement',
        message: '  更换标签指令与本轮证词可以互相印证。  ',
        evidenceId: 'V1',
      },
      userContext(`user-${attackerSeat}`, 5_100),
    );
    expect(state.crossExamStatements).toEqual([
      {
        round: 1,
        match: 1,
        seat: attackerSeat,
        side: 'attacker',
        message: '更换标签指令与本轮证词可以互相印证。',
        evidenceId: 'V1',
        createdAt: 5_100,
      },
    ]);
    expect(state.actionTokens[attackerSeat]).toBe(beforeTokens);

    expect(
      expectReject(
        state,
        { type: 'fashion.crossExam.statement', message: '旁听者不能替双方正式发言。' },
        userContext(`user-${observerSeat}`, 5_200),
      ),
    ).toBe(REASON_FASHION_CROSS_EXAM_STATEMENT_NOT_PARTICIPANT);
    expect(
      expectReject(
        state,
        {
          type: 'fashion.crossExam.statement',
          message: '引用尚未出现的第二轮证据。',
          evidenceId: 'V2',
        },
        userContext(`user-${defenderSeat}`, 5_300),
      ),
    ).toBe(REASON_FASHION_CROSS_EXAM_EVIDENCE_UNAVAILABLE);
    expect(
      expectReject(
        state,
        {
          type: 'fashion.crossExam.statement',
          message: 'x'.repeat(FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH + 1),
        },
        userContext(`user-${defenderSeat}`, 5_350),
      ),
    ).toBe(REASON_FASHION_CROSS_EXAM_STATEMENT_INVALID);

    for (let index = 1; index < FASHION_MAX_CROSS_EXAM_STATEMENTS_PER_MATCH; index += 1) {
      state = dispatch(
        state,
        { type: 'fashion.crossExam.statement', message: `攻击方补充论点 ${index}` },
        userContext(`user-${attackerSeat}`, 5_400 + index),
      );
    }
    expect(
      expectReject(
        state,
        { type: 'fashion.crossExam.statement', message: '超过本组论点上限' },
        userContext(`user-${attackerSeat}`, 5_500),
      ),
    ).toBe(REASON_FASHION_CROSS_EXAM_STATEMENT_LIMIT_REACHED);
    expect(
      expectReject(
        state,
        { type: 'fashion.crossExam.statement', message: '时间结束后不能继续补论点。' },
        userContext(`user-${defenderSeat}`, interrogation.endsAt),
      ),
    ).toBe(REASON_FASHION_CROSS_EXAM_STATEMENT_CLOSED);
  });

  it('records every investigation vote with its round', () => {
    const state = castVotes(advanceToVote(), 4, 191_000);
    expect(state.investigationVoteHistory).toHaveLength(FASHION_PLAYER_COUNT);
    expect(state.investigationVoteHistory).toContainEqual({ round: 1, seat: 0, vote: 'approve' });
    expect(state.investigationVoteHistory).toContainEqual({ round: 1, seat: 6, vote: 'reject' });
  });

  it('runs two cross-exam matches and resolves the best debater by seven-player vote', () => {
    let state = startAndConfirmRoles();
    state = dispatch(state, { type: 'fashion.event.reveal' }, userContext('user-0', 4_000));
    state = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', 5_000));
    expect(state.interrogation?.match).toBe(1);
    state = dispatch(
      state,
      { type: 'fashion.crossExam.finish' },
      userContext('user-0', 5_000 + FASHION_CROSS_EXAM_DURATION_MS),
    );
    expect(state.interrogation?.match).toBe(2);
    state = dispatch(
      state,
      { type: 'fashion.crossExam.finish' },
      userContext('user-0', 5_000 + FASHION_CROSS_EXAM_DURATION_MS * 2),
    );
    expect(state.phase).toBe('discussion');
    expect(state.crossExamParticipantSeats).toHaveLength(4);
    const candidateSeat = state.crossExamParticipantSeats[0];
    if (candidateSeat === undefined) throw new Error('Expected eligible participant');

    expect(
      expectReject(
        state,
        { type: 'fashion.crossExam.award', seat: 99 },
        userContext('user-0', 400_000),
      ),
    ).toBe(REASON_FASHION_CROSS_EXAM_AWARD_INVALID);

    for (let seat = 0; seat < FASHION_PLAYER_COUNT; seat += 1) {
      state = dispatch(
        state,
        { type: 'fashion.crossExam.award', seat: candidateSeat },
        userContext(`user-${seat}`, 400_100 + seat),
      );
    }
    expect(
      expectReject(
        state,
        { type: 'fashion.crossExam.award', seat: candidateSeat },
        userContext('user-0', 400_200),
      ),
    ).toBe(REASON_FASHION_CROSS_EXAM_AWARD_ALREADY_SET);
    state = dispatch(state, { type: 'fashion.discussion.finish' }, userContext('user-0', 400_300));
    expect(state.crossExamAwards).toContainEqual({ round: 1, seat: candidateSeat });
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

  it('recovers one action token up to the opening maximum when the next round starts', () => {
    let state = castVotes(advanceToVote(), 4, 191_000);
    state = finishVoteRound(state, 192_000);
    const participantSeat = state.crossExamParticipantSeats[0];
    if (participantSeat === undefined) throw new Error('Expected round-one cross exam participant');
    expect(state.actionTokens[participantSeat]).toBe(FASHION_INITIAL_ACTION_TOKENS - 1);

    state = dispatch(state, { type: 'fashion.round.advance' }, userContext('user-0', 193_000));
    expect(state.actionTokens[participantSeat]).toBe(FASHION_INITIAL_ACTION_TOKENS);
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
      state = dispatch(state, { type: 'fashion.round.advance' }, userContext('user-0', nowMs));
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

describe('Fashion Shadow identity guess during investigation vote', () => {
  it('reveals the target secret and consumes a token on a successful guess', () => {
    let state = advanceToVote();
    const beforeTokens = state.actionTokens[0];
    if (beforeTokens === undefined) throw new Error('Expected seat 0 action tokens');
    state = dispatch(
      state,
      {
        type: 'fashion.identityGuess.cast',
        targetSeat: 1,
        guessedRoleId: state.roles[1]!,
      },
      userContext('user-0', 4_000),
    );

    expect(state.revealedSecrets[1]).toBe(state.secrets[1]);
    expect(state.actionTokens[0]).toBe(beforeTokens - 1);
  });

  it('blocks the guesser from cross examination after a failed guess', () => {
    let state = advanceToVote();
    const wrongRole = Object.values(state.roles).find((role) => role !== state.roles[1]);
    if (wrongRole === undefined) throw new Error('Expected another role');

    state = dispatch(
      state,
      {
        type: 'fashion.identityGuess.cast',
        targetSeat: 1,
        guessedRoleId: wrongRole,
      },
      userContext('user-0', 4_000),
    );

    expect(state.revealedSecrets[1]).toBeUndefined();
    expect(state.identityGuessPenalties).toContainEqual({
      seat: 0,
      blockedRound: 2,
    });

    state = {
      ...state,
      currentRound: 2,
      phase: 'event',
      currentEvent: FASHION_ROUND_BY_NUMBER[2].eventId,
    };
    state = dispatch(state, { type: 'fashion.crossExam.start' }, userContext('user-0', 5_000));
    expect(state.interrogation?.participantSeats).not.toContain(0);
  });
});

describe('Fashion Shadow final hearing', () => {
  it('uses VictoryEvaluator instead of raw highest vote', () => {
    const base = startAndConfirmRoles();
    const villainSeat = Number(
      Object.entries(base.roles).find(([, role]) => role === 'villainProcurementDirector')?.[0],
    );
    const nonVillainSeat = Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => seat).find(
      (seat) => seat !== villainSeat,
    );
    if (nonVillainSeat === undefined) throw new Error('Expected non-villain seat');
    const state: FashionState = {
      ...base,
      phase: 'hearing',
      finalVotes: Object.fromEntries(
        Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => [seat, nonVillainSeat]),
      ),
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

    expect(next.winners).toContain(villainSeat);
  });
});
