import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_GAME_IN_PROGRESS,
  REASON_NOT_HOST,
  REASON_SYSTEM_ACTOR_REQUIRED,
} from '../../../platform/protocol/reasons';
import { GAME_ENGINE_CATALOG } from '../../catalog';
import type { FibCommand } from '../commands/types';
import type { FibEvent } from '../domain/events';
import {
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_FIB_PLAYER_COUNT_INVALID,
  REASON_FIB_PREPARATION_PROGRESS_INVALID,
  REASON_FIB_ROUND_ALREADY_ONGOING,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_FULL,
  REASON_FIB_WORD_REUSED,
} from '../domain/reasons';
import { getFibRoundView, getFibUserSeat } from '../domain/visibility';
import type { FibEffect } from '../effects/types';
import { decideFibCommand, fibEngine, getFibLifecycle } from '../engine';
import {
  FIB_PREPARATION_PROGRESS,
  type FibState,
  getFibOccupiedSeatCount,
  getFibRole,
  isFibImplicitBotSeat,
} from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '4321',
  hostUserId: 'host',
  nowMs: 1_000,
  commandId: 'create-1',
};

function userContext(
  userId: string,
  options: {
    readonly commandId?: string;
    readonly controlledSeat?: number | null;
    readonly randomSeed?: string;
  } = {},
): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: options.controlledSeat ?? null,
    nowMs: 2_000,
    commandId: options.commandId ?? 'command-1',
    randomSeed: options.randomSeed ?? 'seed-1',
  };
}

function systemContext(randomSeed = 'effect-seed-1'): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'effect-1' },
    controlledSeat: null,
    nowMs: 2_100,
    commandId: 'effect-command-1',
    randomSeed,
  };
}

function createLobby(numberOfPlayers = 4): FibState {
  return fibEngine.createInitialState({ numberOfPlayers }, CREATE_CONTEXT);
}

function applyDecision(state: FibState, decision: Decision<FibEvent, FibEffect>): FibState {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Fib decision, received ${decision.reason}`);
  }
  let nextState = state;
  for (const event of decision.events) {
    nextState = fibEngine.evolve(nextState, event);
  }
  return fibEngine.normalize(nextState);
}

function dispatch(state: FibState, command: FibCommand, context: CommandContext): FibState {
  return applyDecision(state, decideFibCommand(state, command, context));
}

function takeSeat(state: FibState, seat: number, userId: string, displayName = userId): FibState {
  return dispatch(
    state,
    {
      type: 'room.seat.take',
      seat,
      profile: { displayName },
    },
    userContext(userId),
  );
}

function createFullLobby(): FibState {
  const withHost = takeSeat(createLobby(), 0, 'host', '房主');
  return dispatch(withHost, { type: 'room.seat.fillBots' }, userContext('host'));
}

function startPreparing(state: FibState, commandId = 'round-command-1'): FibState {
  return dispatch(state, { type: 'fib.round.start' }, userContext('host', { commandId }));
}

function completeRound(
  state: FibState,
  word: string,
  definition: string,
  randomSeed = 'role-seed-1',
): FibState {
  if (state.phase !== 'preparing') throw new Error('Expected preparing state');
  let readyState = dispatch(
    state,
    {
      type: 'fib.round.updatePreparationProgress',
      roundId: state.pendingRound.roundId,
      progressPercent: FIB_PREPARATION_PROGRESS.generating,
    },
    systemContext(),
  );
  if (readyState.phase !== 'preparing') throw new Error('Expected preparing state');
  readyState = dispatch(
    readyState,
    {
      type: 'fib.round.updatePreparationProgress',
      roundId: readyState.pendingRound.roundId,
      progressPercent: FIB_PREPARATION_PROGRESS.ready,
    },
    systemContext(),
  );
  if (readyState.phase !== 'preparing') throw new Error('Expected preparing state');
  return dispatch(
    readyState,
    {
      type: 'fib.round.complete',
      roundId: readyState.pendingRound.roundId,
      word,
      definition,
      source: 'local',
    },
    systemContext(randomSeed),
  );
}

describe('FibKing engine configuration and seating', () => {
  it('registers the concrete Fib engine in the exhaustive engine catalog', () => {
    expect(GAME_ENGINE_CATALOG.fibking).toBe(fibEngine);
  });

  it('creates compact lobby state and rejects invalid create config', () => {
    expect(createLobby(8)).toEqual({
      gameType: 'fibking',
      stateVersion: 3,
      roomCode: '4321',
      hostUserId: 'host',
      phase: 'lobby',
      numberOfPlayers: 8,
      realSeats: {},
      fillEmptySeatsWithBots: false,
      excludedBotSeats: [],
      usedWords: [],
      pendingRound: null,
      round: null,
    });
    expect(() => fibEngine.createInitialState({ numberOfPlayers: 3 }, CREATE_CONTEXT)).toThrow(
      'Invalid Fib config',
    );
    expect(() =>
      fibEngine.createInitialState({ numberOfPlayers: Number.POSITIVE_INFINITY }, CREATE_CONTEXT),
    ).toThrow('Invalid Fib config');
  });

  it('uses the shared seat semantics for take, move, leave, kick, and clear', () => {
    let state = takeSeat(createLobby(), 0, 'host', '房主');
    state = takeSeat(state, 1, 'alice', 'Alice');
    state = takeSeat(state, 2, 'alice', 'Alice moved');
    expect(state.realSeats[1]).toBeUndefined();
    expect(state.realSeats[2]?.profile.displayName).toBe('Alice moved');

    expect(
      decideFibCommand(state, { type: 'room.seat.kick', seat: 2 }, userContext('alice')),
    ).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
    state = dispatch(state, { type: 'room.seat.kick', seat: 2 }, userContext('host'));
    expect(state.realSeats[2]).toBeUndefined();

    state = takeSeat(state, 3, 'bob', 'Bob');
    state = dispatch(state, { type: 'room.seat.leave' }, userContext('bob'));
    expect(state.realSeats[3]).toBeUndefined();

    state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
    expect(getFibOccupiedSeatCount(state)).toBe(4);
    expect(isFibImplicitBotSeat(state, 1)).toBe(true);
    state = takeSeat(state, 1, 'alice', 'Alice');
    expect(isFibImplicitBotSeat(state, 1)).toBe(false);
    expect(Object.keys(state.realSeats)).toHaveLength(2);

    state = dispatch(state, { type: 'room.seat.clear' }, userContext('host'));
    expect(state.realSeats).toEqual({});
    expect(state.fillEmptySeatsWithBots).toBe(false);
    expect(state.excludedBotSeats).toEqual([]);
    expect(getFibOccupiedSeatCount(state)).toBe(0);
  });

  it('kicks exactly one implicit bot and restores it only when bots are filled again', () => {
    let state = createFullLobby();
    state = dispatch(state, { type: 'room.seat.kick', seat: 2 }, userContext('host'));

    expect(state.excludedBotSeats).toEqual([2]);
    expect(getFibOccupiedSeatCount(state)).toBe(3);
    expect(isFibImplicitBotSeat(state, 2)).toBe(false);
    expect(isFibImplicitBotSeat(state, 3)).toBe(true);
    expect(decideFibCommand(state, { type: 'fib.round.start' }, userContext('host'))).toEqual({
      kind: 'reject',
      reason: REASON_FIB_ROUND_NOT_FULL,
    });

    state = takeSeat(state, 2, 'alice', 'Alice');
    expect(getFibOccupiedSeatCount(state)).toBe(4);
    state = dispatch(state, { type: 'room.seat.leave' }, userContext('alice'));
    expect(getFibOccupiedSeatCount(state)).toBe(3);
    expect(isFibImplicitBotSeat(state, 2)).toBe(false);

    state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
    expect(state.excludedBotSeats).toEqual([]);
    expect(getFibOccupiedSeatCount(state)).toBe(4);
    expect(isFibImplicitBotSeat(state, 2)).toBe(true);
  });

  it('keeps a kicked real seat empty while bot fill remains enabled', () => {
    let state = createFullLobby();
    state = takeSeat(state, 1, 'alice', 'Alice');
    state = dispatch(state, { type: 'room.seat.kick', seat: 1 }, userContext('host'));

    expect(state.realSeats[1]).toBeUndefined();
    expect(state.excludedBotSeats).toEqual([1]);
    expect(isFibImplicitBotSeat(state, 1)).toBe(false);
    expect(isFibImplicitBotSeat(state, 2)).toBe(true);
  });

  it('keeps implicit bot fill and idempotent no-op commands free of N-sized state', () => {
    let state = createLobby(Number.MAX_SAFE_INTEGER);
    state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
    expect(getFibOccupiedSeatCount(state)).toBe(Number.MAX_SAFE_INTEGER);
    expect(Object.keys(state.realSeats)).toHaveLength(0);
    expect(JSON.stringify(state).length).toBeLessThan(300);

    const excludedSeat = Number.MAX_SAFE_INTEGER - 1;
    state = dispatch(state, { type: 'room.seat.kick', seat: excludedSeat }, userContext('host'));
    expect(state.excludedBotSeats).toEqual([excludedSeat]);
    expect(getFibOccupiedSeatCount(state)).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(isFibImplicitBotSeat(state, excludedSeat - 1)).toBe(true);
    expect(JSON.stringify(state).length).toBeLessThan(350);

    state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
    expect(state.excludedBotSeats).toEqual([]);
    expect(decideFibCommand(state, { type: 'room.seat.fillBots' }, userContext('host'))).toEqual({
      kind: 'commit',
      events: [],
      effects: [],
      broadcast: 'none',
      outcome: { kind: 'success' },
    });
  });

  it('supports safe-integer growth without a product max and rejects destructive shrink', () => {
    let state = takeSeat(createLobby(8), 7, 'alice');
    expect(
      decideFibCommand(
        state,
        { type: 'fib.config.update', numberOfPlayers: 7 },
        userContext('host'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE });

    state = dispatch(state, { type: 'room.seat.clear' }, userContext('host'));
    state = dispatch(
      state,
      { type: 'fib.config.update', numberOfPlayers: Number.MAX_SAFE_INTEGER },
      userContext('host'),
    );
    expect(state.numberOfPlayers).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      decideFibCommand(
        state,
        { type: 'fib.config.update', numberOfPlayers: 3 },
        userContext('host'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_PLAYER_COUNT_INVALID });

    state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
    state = dispatch(state, { type: 'room.seat.kick', seat: 7 }, userContext('host'));
    state = dispatch(state, { type: 'fib.config.update', numberOfPlayers: 7 }, userContext('host'));
    expect(state.excludedBotSeats).toEqual([]);
  });

  it('updates only the authenticated real player profile in every phase', () => {
    let state = createFullLobby();
    state = dispatch(
      state,
      { type: 'room.profile.update', profile: { displayName: '新名字' } },
      userContext('host'),
    );
    expect(state.realSeats[0]?.profile.displayName).toBe('新名字');

    state = startPreparing(state);
    state = completeRound(state, '云朵', '悬浮在空中的水滴或冰晶集合');
    state = dispatch(
      state,
      { type: 'room.profile.update', profile: { avatarFrame: 'frame-1' } },
      userContext('host'),
    );
    expect(state.realSeats[0]?.profile.avatarFrame).toBe('frame-1');
  });

  it('locks seat operations outside lobby and rejects controlled-seat room commands', () => {
    const preparing = startPreparing(createFullLobby());
    expect(decideFibCommand(preparing, { type: 'room.seat.leave' }, userContext('host'))).toEqual({
      kind: 'reject',
      reason: REASON_GAME_IN_PROGRESS,
    });
    expect(
      decideFibCommand(
        createFullLobby(),
        { type: 'room.seat.fillBots' },
        userContext('host', { controlledSeat: 1 }),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED });
  });
});

describe('FibKing recoverable round workflow', () => {
  it('requires a full room and emits one durable word-generation effect', () => {
    expect(
      decideFibCommand(createLobby(), { type: 'fib.round.start' }, userContext('host')),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_ROUND_NOT_FULL });

    const state = createFullLobby();
    const decision = decideFibCommand(
      state,
      { type: 'fib.round.start' },
      userContext('host', { commandId: 'round-a', randomSeed: 'unrelated-seed' }),
    );
    expect(decision).toEqual({
      kind: 'commit',
      events: [
        {
          type: 'fib.round.preparing',
          pendingRound: {
            roundId: 'fib-round:round-a',
            requestedAt: 2_000,
            progressPercent: FIB_PREPARATION_PROGRESS.queued,
          },
        },
      ],
      effects: [
        {
          type: 'fib.word.generate',
          payload: { roundId: 'fib-round:round-a', avoidWords: [] },
        },
      ],
      broadcast: 'state',
      outcome: { kind: 'success' },
    });
  });

  it('accepts only the system completion for the current pending round', () => {
    let preparing = startPreparing(createFullLobby());
    const roundId = preparing.phase === 'preparing' ? preparing.pendingRound.roundId : '';
    const command = {
      type: 'fib.round.complete',
      roundId,
      word: '海浪',
      definition: '海水受力形成的波动',
      source: 'local',
    } as const;

    expect(decideFibCommand(preparing, command, userContext('host'))).toEqual({
      kind: 'reject',
      reason: REASON_SYSTEM_ACTOR_REQUIRED,
    });
    expect(
      decideFibCommand(preparing, { ...command, roundId: 'stale-round' }, systemContext()),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_ROUND_MISMATCH });
    expect(decideFibCommand(preparing, command, systemContext())).toEqual({
      kind: 'reject',
      reason: REASON_FIB_PREPARATION_PROGRESS_INVALID,
    });

    preparing = dispatch(
      preparing,
      {
        type: 'fib.round.updatePreparationProgress',
        roundId,
        progressPercent: FIB_PREPARATION_PROGRESS.generating,
      },
      systemContext(),
    );
    preparing = dispatch(
      preparing,
      {
        type: 'fib.round.updatePreparationProgress',
        roundId,
        progressPercent: FIB_PREPARATION_PROGRESS.ready,
      },
      systemContext(),
    );
    const ongoing = dispatch(preparing, command, systemContext('roles-a'));
    expect(ongoing.phase).toBe('ongoing');
    if (ongoing.phase !== 'ongoing') throw new Error('Expected ongoing state');
    expect(ongoing.round.roles.guesserSeat).not.toBe(ongoing.round.roles.honestSeat);
    expect(getFibRole(ongoing.round.roles, ongoing.round.roles.guesserSeat)).toBe('guesser');
    expect(getFibRole(ongoing.round.roles, ongoing.round.roles.honestSeat)).toBe('honest');
    expect(ongoing.usedWords).toEqual(['海浪']);
  });

  it('accepts only monotonic system preparation progress for the current round', () => {
    let preparing = startPreparing(createFullLobby());
    if (preparing.phase !== 'preparing') throw new Error('Expected preparing state');
    const roundId = preparing.pendingRound.roundId;
    const generatingCommand = {
      type: 'fib.round.updatePreparationProgress',
      roundId,
      progressPercent: FIB_PREPARATION_PROGRESS.generating,
    } as const;

    expect(preparing.pendingRound.progressPercent).toBe(FIB_PREPARATION_PROGRESS.queued);
    expect(decideFibCommand(preparing, generatingCommand, userContext('host'))).toEqual({
      kind: 'reject',
      reason: REASON_SYSTEM_ACTOR_REQUIRED,
    });
    expect(
      decideFibCommand(
        preparing,
        { ...generatingCommand, roundId: 'stale-round' },
        systemContext(),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_ROUND_MISMATCH });
    expect(
      decideFibCommand(
        preparing,
        { ...generatingCommand, progressPercent: FIB_PREPARATION_PROGRESS.ready },
        systemContext(),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_PREPARATION_PROGRESS_INVALID });

    preparing = dispatch(preparing, generatingCommand, systemContext());
    if (preparing.phase !== 'preparing') throw new Error('Expected preparing state');
    expect(preparing.pendingRound.progressPercent).toBe(FIB_PREPARATION_PROGRESS.generating);
    expect(decideFibCommand(preparing, generatingCommand, systemContext())).toEqual({
      kind: 'reject',
      reason: REASON_FIB_PREPARATION_PROGRESS_INVALID,
    });
    preparing = dispatch(
      preparing,
      {
        type: 'fib.round.updatePreparationProgress',
        roundId,
        progressPercent: FIB_PREPARATION_PROGRESS.ready,
      },
      systemContext(),
    );
    if (preparing.phase !== 'preparing') throw new Error('Expected preparing state');
    expect(preparing.pendingRound.progressPercent).toBe(FIB_PREPARATION_PROGRESS.ready);
  });

  it('supports host cancellation without losing seats or word history', () => {
    let state = completeRound(startPreparing(createFullLobby()), '灯塔', '指引船只航行的高塔');
    state = dispatch(state, { type: 'fib.round.reveal' }, userContext('host'));
    state = startPreparing(state, 'round-b');
    const realSeats = state.realSeats;
    state = dispatch(state, { type: 'fib.round.cancelPreparing' }, userContext('host'));

    expect(state.phase).toBe('lobby');
    expect(state.realSeats).toBe(realSeats);
    expect(state.usedWords).toEqual(['灯塔']);
    expect(state.fillEmptySeatsWithBots).toBe(true);
  });

  it('uses next round as the ended-phase action and preserves seats and used words', () => {
    let state = completeRound(startPreparing(createFullLobby()), '灯塔', '指引船只航行的高塔');
    state = dispatch(state, { type: 'fib.round.reveal' }, userContext('host'));
    expect(state.phase).toBe('ended');
    const realSeats = state.realSeats;

    const nextDecision = decideFibCommand(
      state,
      { type: 'fib.round.start' },
      userContext('host', { commandId: 'round-next' }),
    );
    expect(nextDecision.kind).toBe('commit');
    if (nextDecision.kind !== 'commit') throw new Error('Expected next-round commit');
    expect(nextDecision.effects).toEqual([
      {
        type: 'fib.word.generate',
        payload: { roundId: 'fib-round:round-next', avoidWords: ['灯塔'] },
      },
    ]);
    state = applyDecision(state, nextDecision);
    expect(state.realSeats).toBe(realSeats);
    expect(state.usedWords).toEqual(['灯塔']);
    expect(state.phase).toBe('preparing');

    if (state.phase !== 'preparing') throw new Error('Expected preparing state');
    state = dispatch(
      state,
      {
        type: 'fib.round.updatePreparationProgress',
        roundId: state.pendingRound.roundId,
        progressPercent: FIB_PREPARATION_PROGRESS.generating,
      },
      systemContext(),
    );
    if (state.phase !== 'preparing') throw new Error('Expected preparing state');
    state = dispatch(
      state,
      {
        type: 'fib.round.updatePreparationProgress',
        roundId: state.pendingRound.roundId,
        progressPercent: FIB_PREPARATION_PROGRESS.ready,
      },
      systemContext(),
    );
    if (state.phase !== 'preparing') throw new Error('Expected preparing state');
    expect(
      decideFibCommand(
        state,
        {
          type: 'fib.round.complete',
          roundId: state.pendingRound.roundId,
          word: '灯塔',
          definition: '这是一个重复词语的定义。',
          source: 'local',
        },
        systemContext(),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_WORD_REUSED });
  });

  it('rejects another start while preparing or ongoing', () => {
    const preparing = startPreparing(createFullLobby());
    expect(decideFibCommand(preparing, { type: 'fib.round.start' }, userContext('host'))).toEqual({
      kind: 'reject',
      reason: REASON_FIB_ROUND_ALREADY_ONGOING,
    });

    const ongoing = completeRound(preparing, '山谷', '两山之间低洼狭长的地带');
    expect(decideFibCommand(ongoing, { type: 'fib.round.start' }, userContext('host'))).toEqual({
      kind: 'reject',
      reason: REASON_FIB_ROUND_ALREADY_ONGOING,
    });
  });

  it('maps game phases to the shared lifecycle without renaming domain phases', () => {
    const lobby = createFullLobby();
    const preparing = startPreparing(lobby);
    const ongoing = completeRound(preparing, '山谷', '两山之间低洼狭长的地带');
    const ended = dispatch(ongoing, { type: 'fib.round.reveal' }, userContext('host'));

    expect(getFibLifecycle(lobby)).toBe('setup');
    expect(getFibLifecycle(preparing)).toBe('ongoing');
    expect(getFibLifecycle(ongoing)).toBe('ongoing');
    expect(getFibLifecycle(ended)).toBe('ended');
  });

  it('derives one authoritative round view for every seat perspective', () => {
    const ongoing = completeRound(
      startPreparing(createFullLobby()),
      '山谷',
      '两山之间低洼狭长的地带',
      'visibility-seed',
    );
    if (ongoing.phase !== 'ongoing') throw new Error('Expected ongoing state');

    const { guesserSeat, honestSeat } = ongoing.round.roles;
    const fibberSeat = [0, 1, 2, 3].find((seat) => seat !== guesserSeat && seat !== honestSeat);
    if (fibberSeat === undefined) throw new Error('Expected a Fibber seat');

    expect(getFibUserSeat(ongoing, 'host')).toBe(0);
    expect(getFibUserSeat(ongoing, 'missing')).toBeNull();
    expect(getFibRoundView(ongoing, guesserSeat)).toMatchObject({
      viewerRole: 'guesser',
      word: '山谷',
      definition: null,
      guesserSeat,
      honestSeat: null,
    });
    expect(getFibRoundView(ongoing, honestSeat)).toMatchObject({
      viewerRole: 'honest',
      word: '山谷',
      definition: '两山之间低洼狭长的地带',
      guesserSeat,
      honestSeat: null,
    });
    expect(getFibRoundView(ongoing, fibberSeat)).toMatchObject({
      viewerRole: 'fibber',
      word: '山谷',
      definition: null,
      guesserSeat,
      honestSeat: null,
    });
    expect(getFibRoundView(ongoing, null)).toBeNull();

    const ended = dispatch(ongoing, { type: 'fib.round.reveal' }, userContext('host'));
    expect(getFibRoundView(ended, null)).toMatchObject({
      phase: 'ended',
      viewerRole: null,
      word: '山谷',
      definition: '两山之间低洼狭长的地带',
      guesserSeat,
      honestSeat,
    });
    expect(() => getFibRoundView(ended, 4)).toThrow('Invalid Fib viewer seat: 4');
  });
});
