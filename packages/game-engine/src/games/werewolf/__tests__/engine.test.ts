import type { CommandContext, CreateGameContext } from '../../../platform/engine';
import { GAME_TYPES } from '../../../platform/protocol/gameTypes';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
  REASON_SEAT_EMPTY,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../../platform/protocol/reasons';
import { GAME_ENGINE_CATALOG } from '../../catalog';
import type { WerewolfCommand } from '../commands/types';
import {
  REASON_ACTION_INPUT_MISMATCH,
  REASON_ACTION_STEP_CHANGED,
  resolveSubmitActionIntent,
} from '../domain/actionInput';
import { resolveEffectiveSeatActor, resolveSystemActor, resolveUserActor } from '../domain/actor';
import { handlerResultToDecision } from '../domain/decision';
import { handlerError, handlerRejection, handlerSuccess } from '../domain/handlers/types';
import type { SubmitActionIntent } from '../domain/intents/types';
import { GameStatus, type GameTemplate, type RoleId } from '../domain/models';
import type { GameState, SheriffElectionState } from '../domain/protocol/types';
import type { StateAction } from '../domain/reducer/types';
import { buildInitialGameState } from '../domain/state/buildInitialState';
import { getWerewolfLifecycle, werewolfEngine } from '../engine';
import { WEREWOLF_STATE_VERSION } from '../state/version';

const TEMPLATE: GameTemplate = {
  name: 'test',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'hunter', 'villager'],
};

function createState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...buildInitialGameState('1234', 'host', TEMPLATE),
    players: {
      0: { userId: 'host', seat: 0, role: 'wolf', hasViewedRole: true },
      1: { userId: 'user-1', seat: 1, role: 'seer', hasViewedRole: true },
      2: { userId: 'bot-2', seat: 2, role: 'hunter', hasViewedRole: true, isBot: true },
      3: null,
    },
    roster: {
      host: { displayName: 'Host' },
      'user-1': { displayName: 'User 1' },
      'bot-2': { displayName: 'Bot 2' },
    },
    ...overrides,
  };
}

function userContext(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 1_000,
    commandId: 'command-1',
    randomSeed: 'seed-1',
  };
}

function systemContext(): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'effect-1' },
    controlledSeat: null,
    nowMs: 1_000,
    commandId: 'command-1',
    randomSeed: 'seed-1',
  };
}

function evolveCommittedCommand(
  state: GameState,
  command: WerewolfCommand,
  context: CommandContext,
): GameState {
  const decision = werewolfEngine.decide(state, command, context);
  if (decision.kind === 'reject') {
    throw new Error(`Expected command commit, received ${decision.reason}`);
  }
  return decision.events.reduce(werewolfEngine.evolve, state);
}

describe('Werewolf authoritative actor resolution', () => {
  it('resolves the real user seat and host-controlled bot seat', () => {
    const state = createState();

    expect(resolveEffectiveSeatActor(state, userContext('user-1'))).toMatchObject({
      kind: 'resolved',
      value: { userId: 'user-1', seat: 1 },
    });
    expect(resolveEffectiveSeatActor(state, userContext('host', 2))).toMatchObject({
      kind: 'resolved',
      value: { userId: 'host', seat: 2 },
    });
  });

  it('rejects controlled humans, empty seats, and non-host bot control', () => {
    const state = createState();

    expect(resolveEffectiveSeatActor(state, userContext('host', 1))).toEqual({
      kind: 'rejected',
      reason: REASON_CONTROLLED_SEAT_NOT_BOT,
    });
    expect(resolveEffectiveSeatActor(state, userContext('host', 3))).toEqual({
      kind: 'rejected',
      reason: REASON_SEAT_EMPTY,
    });
    expect(resolveEffectiveSeatActor(state, userContext('user-1', 2))).toEqual({
      kind: 'rejected',
      reason: REASON_NOT_HOST,
    });
  });

  it('keeps user and system principals mutually exclusive', () => {
    const state = createState();

    expect(resolveUserActor(state, systemContext())).toEqual({
      kind: 'rejected',
      reason: REASON_USER_ACTOR_REQUIRED,
    });
    expect(resolveSystemActor(state, userContext('host'))).toEqual({
      kind: 'rejected',
      reason: REASON_SYSTEM_ACTOR_REQUIRED,
    });
  });
});

describe('Werewolf action input adapter', () => {
  it.each<{
    stepId: GameState['currentStepId'];
    role: RoleId;
    input: Extract<WerewolfCommand, { type: 'werewolf.action.submit' }>['input'];
    payload: SubmitActionIntent['payload'];
  }>([
    {
      stepId: 'seerCheck',
      role: 'seer',
      input: { kind: 'target', target: 3 },
      payload: {
        seat: 1,
        role: 'seer',
        actionInput: { schemaId: 'seerCheck', target: 3 },
      },
    },
    {
      stepId: 'magicianSwap',
      role: 'magician',
      input: { kind: 'multiTarget', targets: [0, 3] },
      payload: {
        seat: 1,
        role: 'magician',
        actionInput: { schemaId: 'magicianSwap', targets: [0, 3] },
      },
    },
    {
      stepId: 'hunterConfirm',
      role: 'hunter',
      input: { kind: 'confirm' },
      payload: {
        seat: 1,
        role: 'hunter',
        actionInput: { schemaId: 'hunterConfirm', confirmed: true },
      },
    },
    {
      stepId: 'witchAction',
      role: 'witch',
      input: { kind: 'witch', saveTarget: 0, poisonTarget: null },
      payload: {
        seat: 1,
        role: 'witch',
        actionInput: {
          schemaId: 'witchAction',
          target: 1,
          stepResults: { save: 0, poison: null },
        },
      },
    },
    {
      stepId: 'thiefChoose',
      role: 'thief',
      input: { kind: 'card', cardIndex: 1 },
      payload: {
        seat: 1,
        role: 'thief',
        actionInput: { schemaId: 'thiefChoose', cardIndex: 1 },
      },
    },
    {
      stepId: 'wolfKill',
      role: 'wolf',
      input: { kind: 'target', target: null },
      payload: { seat: 1, role: 'wolf', actionInput: { schemaId: 'wolfKill' } },
    },
  ])('maps $input.kind into the typed handler intent', ({ stepId, role, input, payload }) => {
    const state = createState({
      status: GameStatus.Ongoing,
      currentStepId: stepId,
      players: {
        ...createState().players,
        1: { userId: 'user-1', seat: 1, role, hasViewedRole: true },
      },
    });

    expect(resolveSubmitActionIntent(state, 1, input)).toEqual({
      kind: 'resolved',
      intent: { type: 'SUBMIT_ACTION', payload },
    });
  });

  it('rejects a typed input whose kind does not match the authoritative current schema', () => {
    const state = createState({ status: GameStatus.Ongoing, currentStepId: 'seerCheck' });

    expect(resolveSubmitActionIntent(state, 1, { kind: 'confirm' })).toEqual({
      kind: 'rejected',
      reason: REASON_ACTION_INPUT_MISMATCH,
    });
  });

  it('rejects a confirmed action after its authoritative step identity changes', () => {
    const state = createState({
      status: GameStatus.Ongoing,
      currentStepId: 'seerCheck',
      currentStepIndex: 4,
      roleRevealRandomNonce: 'game-2',
    });

    expect(
      resolveSubmitActionIntent(
        state,
        1,
        { kind: 'target', target: 3 },
        {
          currentStepId: 'seerCheck',
          currentStepIndex: 3,
          roleRevealRandomNonce: 'game-2',
        },
      ),
    ).toEqual({ kind: 'rejected', reason: REASON_ACTION_STEP_CHANGED });
  });

  it.each<[GameState['currentStepId'], RoleId]>([
    ['seerCheck', 'seer'],
    ['magicianSwap', 'magician'],
    ['hunterConfirm', 'hunter'],
    ['witchAction', 'witch'],
    ['thiefChoose', 'thief'],
    ['piperHypnotize', 'piper'],
  ])('maps one canonical skip input for %s', (stepId, role) => {
    const state = createState({
      status: GameStatus.Ongoing,
      currentStepId: stepId,
      players: {
        ...createState().players,
        1: { userId: 'user-1', seat: 1, role, hasViewedRole: true },
      },
    });

    expect(resolveSubmitActionIntent(state, 1, { kind: 'skip' })).toEqual({
      kind: 'resolved',
      intent: {
        type: 'SUBMIT_ACTION',
        payload: { seat: 1, role, actionInput: { schemaId: stepId } },
      },
    });
  });

  it.each<
    [
      GameState['currentStepId'],
      Extract<WerewolfCommand, { type: 'werewolf.action.submit' }>['input'],
    ]
  >([
    ['seerCheck', { kind: 'target', target: null }],
    ['piperHypnotize', { kind: 'multiTarget', targets: [] }],
    ['witchAction', { kind: 'witch', saveTarget: null, poisonTarget: null }],
  ])('rejects duplicate skip encoding for %s', (stepId, input) => {
    const state = createState({ status: GameStatus.Ongoing, currentStepId: stepId });

    expect(resolveSubmitActionIntent(state, 1, input)).toEqual({
      kind: 'rejected',
      reason: REASON_ACTION_INPUT_MISMATCH,
    });
  });
});

describe('Werewolf handler decision adapter', () => {
  const state = createState();
  const context = userContext('host');

  it('maps error, no-op success, and domain rejection without losing semantics', () => {
    expect(handlerResultToDecision(state, handlerError('invalid_status'), context)).toEqual({
      kind: 'reject',
      reason: 'invalid_status',
    });
    expect(handlerResultToDecision(state, handlerSuccess([]), context)).toEqual({
      kind: 'commit',
      events: [],
      effects: [],
      broadcast: 'none',
      outcome: { kind: 'success' },
    });

    const event: StateAction = {
      type: 'ACTION_REJECTED',
      payload: {
        action: 'seerCheck',
        reason: 'blocked',
        targetUserId: 'user-1',
        rejectionId: 'command-1',
      },
    };
    expect(handlerResultToDecision(state, handlerRejection('blocked', [event]), context)).toEqual({
      kind: 'commit',
      events: [event],
      effects: [],
      broadcast: 'state',
      outcome: { kind: 'domainRejected', reason: 'blocked' },
    });
  });
});

describe('Werewolf engine definition and catalog', () => {
  const commandByType = {
    'room.seat.take': {
      type: 'room.seat.take',
      seat: 3,
      profile: { displayName: 'Host' },
    },
    'room.seat.leave': { type: 'room.seat.leave' },
    'room.seat.kick': { type: 'room.seat.kick', seat: 1 },
    'room.seat.clear': { type: 'room.seat.clear' },
    'room.seat.fillBots': { type: 'room.seat.fillBots' },
    'room.profile.update': {
      type: 'room.profile.update',
      profile: { displayName: 'Updated' },
    },
    'werewolf.roles.assign': { type: 'werewolf.roles.assign' },
    'werewolf.game.restart': { type: 'werewolf.game.restart' },
    'werewolf.bots.markRolesViewed': { type: 'werewolf.bots.markRolesViewed' },
    'werewolf.action.submit': {
      type: 'werewolf.action.submit',
      input: { kind: 'skip' },
    },
    'werewolf.role.view': { type: 'werewolf.role.view' },
    'werewolf.config.update': {
      type: 'werewolf.config.update',
      templateRoles: ['villager'],
    },
    'werewolf.review.share': { type: 'werewolf.review.share', allowedSeats: [0] },
    'werewolf.board.nominate': {
      type: 'werewolf.board.nominate',
      displayName: 'Host',
      roles: ['villager'],
    },
    'werewolf.board.upvote': {
      type: 'werewolf.board.upvote',
      targetUserId: 'user-1',
    },
    'werewolf.board.withdraw': { type: 'werewolf.board.withdraw' },
    'werewolf.night.start': { type: 'werewolf.night.start' },
    'werewolf.sheriff.register': { type: 'werewolf.sheriff.register' },
    'werewolf.sheriff.cancelRegistration': { type: 'werewolf.sheriff.cancelRegistration' },
    'werewolf.sheriff.withdraw': { type: 'werewolf.sheriff.withdraw' },
    'werewolf.sheriff.vote': { type: 'werewolf.sheriff.vote', targetSeat: null },
    'werewolf.sheriff.advance': { type: 'werewolf.sheriff.advance' },
    'werewolf.audio.ack': { type: 'werewolf.audio.ack' },
    'werewolf.progress.request': { type: 'werewolf.progress.request' },
    'werewolf.reveal.ack': { type: 'werewolf.reveal.ack' },
    'werewolf.wolfRobot.ackHunterStatus': {
      type: 'werewolf.wolfRobot.ackHunterStatus',
    },
    'werewolf.groupConfirm.ack': { type: 'werewolf.groupConfirm.ack' },
    'werewolf.groupConfirm.ackBots': { type: 'werewolf.groupConfirm.ackBots' },
    'werewolf.growth.applyRosterLevels': {
      type: 'werewolf.growth.applyRosterLevels',
      levels: { host: 2 },
    },
  } as const satisfies Record<WerewolfCommand['type'], WerewolfCommand>;

  it('registers exactly one concrete engine for every current game type', () => {
    expect(Object.keys(GAME_ENGINE_CATALOG)).toEqual([...GAME_TYPES]);
    expect(GAME_ENGINE_CATALOG.werewolf).toBe(werewolfEngine);
  });

  it('exhaustively dispatches every command discriminant', () => {
    const state = createState();
    const commands = Object.values(commandByType);

    for (const command of commands) {
      const context =
        command.type === 'werewolf.growth.applyRosterLevels'
          ? systemContext()
          : userContext('host');
      const decisionState =
        command.type === 'werewolf.config.update'
          ? createState({
              players: {
                0: { userId: 'host', seat: 0, role: null, hasViewedRole: false },
                1: { userId: 'user-1', seat: 1, role: null, hasViewedRole: false },
                2: {
                  userId: 'bot-2',
                  seat: 2,
                  role: null,
                  hasViewedRole: false,
                  isBot: true,
                },
                3: null,
              },
            })
          : state;
      expect(['commit', 'reject']).toContain(
        werewolfEngine.decide(decisionState, command, context).kind,
      );
    }
  });

  it('allows the original actor to acknowledge a reveal released in a later step', () => {
    const state = createState({
      status: GameStatus.Ongoing,
      currentStepId: 'seedWolfInfectReveal',
      pendingRevealAcks: ['seerCheck'],
      actions: [{ schemaId: 'seerCheck', actorSeat: 1, targetSeat: 0, timestamp: 1 }],
    });

    const decision = werewolfEngine.decide(
      state,
      { type: 'werewolf.reveal.ack' },
      userContext('user-1'),
    );

    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit') {
      expect(decision.events).toContainEqual({ type: 'CLEAR_REVEAL_ACKS' });
    }
  });

  it.each([
    'room.seat.kick',
    'room.seat.clear',
    'room.seat.fillBots',
    'werewolf.roles.assign',
    'werewolf.game.restart',
    'werewolf.bots.markRolesViewed',
    'werewolf.config.update',
    'werewolf.review.share',
    'werewolf.night.start',
    'werewolf.sheriff.advance',
    'werewolf.audio.ack',
    'werewolf.progress.request',
    'werewolf.groupConfirm.ackBots',
  ] as const)('rejects non-host execution of %s', (type) => {
    expect(
      werewolfEngine.decide(createState(), commandByType[type], userContext('user-1')),
    ).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
  });

  it('rejects system principals for public commands and users for internal commands', () => {
    expect(
      werewolfEngine.decide(
        createState(),
        commandByType['werewolf.board.withdraw'],
        systemContext(),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_USER_ACTOR_REQUIRED });
    expect(
      werewolfEngine.decide(
        createState(),
        commandByType['werewolf.growth.applyRosterLevels'],
        userContext('host'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_SYSTEM_ACTOR_REQUIRED });
  });

  it('allows controlledSeat only for seat-owned commands', () => {
    const allowedTypes = new Set<WerewolfCommand['type']>([
      'werewolf.action.submit',
      'werewolf.role.view',
      'werewolf.reveal.ack',
      'werewolf.wolfRobot.ackHunterStatus',
      'werewolf.groupConfirm.ack',
      'werewolf.sheriff.register',
      'werewolf.sheriff.cancelRegistration',
      'werewolf.sheriff.withdraw',
      'werewolf.sheriff.vote',
    ]);

    for (const command of Object.values(commandByType)) {
      if (command.type === 'werewolf.growth.applyRosterLevels') continue;
      const decision = werewolfEngine.decide(createState(), command, userContext('host', 2));

      if (allowedTypes.has(command.type)) {
        expect(decision).not.toEqual({
          kind: 'reject',
          reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
        });
      } else {
        expect(decision).toEqual({
          kind: 'reject',
          reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
        });
      }
    }
  });

  it('passes the submitted step identity through the engine before action resolution', () => {
    const state = createState({
      status: GameStatus.Ongoing,
      currentStepId: 'seerCheck',
      currentStepIndex: 4,
      roleRevealRandomNonce: 'game-2',
    });

    expect(
      werewolfEngine.decide(
        state,
        {
          type: 'werewolf.action.submit',
          input: { kind: 'target', target: 3 },
          expectedStep: {
            currentStepId: 'seerCheck',
            currentStepIndex: 3,
            roleRevealRandomNonce: 'game-2',
          },
        },
        userContext('user-1'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_ACTION_STEP_CHANGED });
  });

  it('creates identified state from config and fails fast on invalid config', () => {
    const context: CreateGameContext = {
      roomCode: '9876',
      hostUserId: 'creator',
      nowMs: 1_000,
      commandId: 'create-1',
    };
    const state = werewolfEngine.createInitialState(
      { templateRoles: ['wolf', 'seer', 'villager', 'villager'] },
      context,
    );

    expect(state).toMatchObject({
      gameType: 'werewolf',
      stateVersion: WEREWOLF_STATE_VERSION,
      roomCode: '9876',
      hostUserId: 'creator',
      status: GameStatus.Unseated,
      rules: { isSheriffElectionEnabled: true },
    });
    expect(Object.keys(state.players)).toHaveLength(4);
    expect(
      werewolfEngine.createInitialState(
        {
          templateRoles: ['wolf', 'seer', 'villager', 'villager'],
          rules: { isSheriffElectionEnabled: false },
        },
        context,
      ).rules?.isSheriffElectionEnabled,
    ).toBe(false);
    expect(() => werewolfEngine.createInitialState({ templateRoles: [] }, context)).toThrow(
      'Invalid Werewolf config:',
    );
  });

  it.each([
    [GameStatus.Unseated, 'setup'],
    [GameStatus.Seated, 'setup'],
    [GameStatus.Assigned, 'setup'],
    [GameStatus.Ready, 'setup'],
    [GameStatus.Ongoing, 'ongoing'],
    [GameStatus.Day, 'ongoing'],
    [GameStatus.Ended, 'ended'],
  ] as const)('derives %s as %s lifecycle', (status, lifecycle) => {
    expect(getWerewolfLifecycle(createState({ status }))).toBe(lifecycle);
  });

  it('emits one game-ended effect with every occupied participant on the ended transition', () => {
    const state = createState({
      status: GameStatus.Ongoing,
      currentStepId: undefined,
      currentNightResults: { wolfVotesBySeat: { '0': 1 } },
      isAudioPlaying: false,
    });

    const decision = werewolfEngine.decide(
      state,
      commandByType['werewolf.progress.request'],
      userContext('host'),
    );
    if (decision.kind === 'reject') {
      throw new Error(`Expected ended transition commit, received ${decision.reason}`);
    }

    expect(decision.effects).toEqual([
      {
        type: 'werewolf.game.ended',
        payload: {
          roomCode: '1234',
          participants: [
            { userId: 'host', role: 'wolf', isBot: false },
            { userId: 'user-1', role: 'seer', isBot: false },
            { userId: 'bot-2', role: 'hunter', isBot: true },
          ],
        },
      },
    ]);
  });

  it('does not emit the game-ended effect for rejected, non-transitioning, or ended commands', () => {
    const rejected = werewolfEngine.decide(
      createState(),
      commandByType['room.seat.clear'],
      userContext('user-1'),
    );
    expect(rejected).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
    expect(rejected).not.toHaveProperty('effects');

    const noTransition = werewolfEngine.decide(
      createState({ status: GameStatus.Ongoing, currentStepId: 'seerCheck' }),
      commandByType['werewolf.progress.request'],
      userContext('host'),
    );
    expect(noTransition).toMatchObject({ kind: 'commit', effects: [] });

    const alreadyEnded = werewolfEngine.decide(
      createState({ status: GameStatus.Ended }),
      commandByType['werewolf.review.share'],
      userContext('host'),
    );
    expect(alreadyEnded).toMatchObject({ kind: 'commit', effects: [] });
  });

  it('fails fast when an occupied seat has no role at the ended transition', () => {
    const state = createState({
      status: GameStatus.Ongoing,
      currentStepId: undefined,
      currentNightResults: { wolfVotesBySeat: { '0': 1 } },
      isAudioPlaying: false,
      players: {
        ...createState().players,
        1: { userId: 'user-1', seat: 1, hasViewedRole: true },
      },
    });

    expect(() =>
      werewolfEngine.decide(state, commandByType['werewolf.progress.request'], userContext('host')),
    ).toThrow('[FAIL-FAST] Ended Werewolf game has no assigned role for occupied seat 1');
  });

  it('excludes all registered seats from first voting and only runoff candidates from runoff voting', () => {
    let state = createState({
      status: GameStatus.Ongoing,
      templateRoles: ['wolf', 'seer', 'hunter', 'villager', 'villager'],
      rules: { isSheriffElectionEnabled: true },
      roleRevealRandomNonce: 's4',
      currentStepId: undefined,
      currentNightResults: {},
      isAudioPlaying: false,
      players: {
        0: { userId: 'host', seat: 0, role: 'wolf', hasViewedRole: true },
        1: { userId: 'user-1', seat: 1, role: 'seer', hasViewedRole: true },
        2: { userId: 'bot-2', seat: 2, role: 'hunter', hasViewedRole: true, isBot: true },
        3: { userId: 'user-3', seat: 3, role: 'villager', hasViewedRole: true },
        4: { userId: 'user-4', seat: 4, role: 'villager', hasViewedRole: true },
      },
      roster: {
        host: { displayName: 'Host' },
        'user-1': { displayName: 'User 1' },
        'bot-2': { displayName: 'Bot 2' },
        'user-3': { displayName: 'User 3' },
        'user-4': { displayName: 'User 4' },
      },
    });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.progress.request' },
      userContext('host'),
    );
    expect(state).toMatchObject({
      status: GameStatus.Day,
      isAudioPlaying: true,
      pendingAudioEffects: [{ audioKey: 'night_end' }],
      sheriffElection: { phase: 'registration', registeredSeats: [] },
    });
    state = evolveCommittedCommand(state, { type: 'werewolf.audio.ack' }, userContext('host'));
    expect(state).toMatchObject({
      status: GameStatus.Day,
      isAudioPlaying: false,
      sheriffElection: { phase: 'registration' },
    });
    expect(state.pendingAudioEffects).toBeUndefined();

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.register' },
      userContext('host', 2),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.register' },
      userContext('user-1'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.register' },
      userContext('host'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.advance' },
      userContext('host'),
    );
    expect(state.sheriffElection).toMatchObject({
      phase: 'candidateSpeech',
      speakingOrder: [0, 1, 2],
    });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.withdraw' },
      userContext('user-1'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.advance' },
      userContext('host'),
    );
    expect(state.sheriffElection).toMatchObject({
      phase: 'firstVote',
      withdrawnSeats: [1],
      candidateSeats: [2, 0],
      eligibleVoterSeats: [3, 4],
    });

    expect(
      werewolfEngine.decide(
        state,
        { type: 'werewolf.sheriff.vote', targetSeat: 2 },
        userContext('user-1'),
      ),
    ).toEqual({ kind: 'reject', reason: 'not_eligible_voter' });
    expect(
      werewolfEngine.decide(state, { type: 'werewolf.sheriff.advance' }, userContext('host')),
    ).toEqual({ kind: 'reject', reason: 'pending_votes' });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.vote', targetSeat: 0 },
      userContext('user-3'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.vote', targetSeat: 2 },
      userContext('user-4'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.advance' },
      userContext('host'),
    );
    expect(state.sheriffElection).toMatchObject({
      phase: 'runoffSpeech',
      candidateSeats: [2, 0],
      speakingOrder: [2, 0],
      completedRounds: [
        {
          round: 'first',
          ballots: { 3: 0, 4: 2 },
          voteCounts: { 0: 1, 2: 1 },
        },
      ],
    });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.advance' },
      userContext('host'),
    );
    expect(state.sheriffElection).toMatchObject({
      phase: 'runoffVote',
      candidateSeats: [2, 0],
      eligibleVoterSeats: [1, 3, 4],
    });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.vote', targetSeat: 0 },
      userContext('user-1'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.vote', targetSeat: 0 },
      userContext('user-3'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.vote', targetSeat: 0 },
      userContext('user-4'),
    );
    const finalDecision = werewolfEngine.decide(
      state,
      { type: 'werewolf.sheriff.advance' },
      userContext('host'),
    );
    if (finalDecision.kind === 'reject') {
      throw new Error(`Expected election completion, received ${finalDecision.reason}`);
    }
    state = finalDecision.events.reduce(werewolfEngine.evolve, state);

    expect(state).toMatchObject({
      status: GameStatus.Ended,
      sheriffElection: {
        phase: 'completed',
        registeredSeats: [2, 1, 0],
        withdrawnSeats: [1],
        completedRounds: [{ round: 'first' }, { round: 'runoff', voteCounts: { 0: 3, 2: 0 } }],
      },
      sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
    });
    expect(finalDecision.effects).toHaveLength(1);
    expect(finalDecision.effects[0]?.type).toBe('werewolf.game.ended');
  });

  it('cancels registration without recording withdrawal and allows registration again', () => {
    let state = createState({
      status: GameStatus.Day,
      rules: { isSheriffElectionEnabled: true },
      isAudioPlaying: false,
      currentNightResults: {},
      sheriffElection: {
        phase: 'registration',
        registeredSeats: [],
        withdrawnSeats: [],
        completedRounds: [],
      },
    });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.register' },
      userContext('user-1'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.cancelRegistration' },
      userContext('user-1'),
    );
    expect(state.sheriffElection).toMatchObject({
      phase: 'registration',
      registeredSeats: [],
      withdrawnSeats: [],
    });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.register' },
      userContext('user-1'),
    );
    expect(state.sheriffElection).toMatchObject({
      registeredSeats: [1],
      withdrawnSeats: [],
    });
    expect(
      werewolfEngine.decide(state, { type: 'werewolf.sheriff.withdraw' }, userContext('user-1')),
    ).toEqual({ kind: 'reject', reason: 'invalid_election_phase' });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.advance' },
      userContext('host'),
    );
    expect(state.sheriffElection?.phase).toBe('candidateSpeech');
    expect(
      werewolfEngine.decide(
        state,
        { type: 'werewolf.sheriff.cancelRegistration' },
        userContext('user-1'),
      ),
    ).toEqual({ kind: 'reject', reason: 'invalid_election_phase' });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.withdraw' },
      userContext('user-1'),
    );
    expect(state.sheriffElection?.withdrawnSeats).toEqual([1]);
  });

  it('uses the seeded counterclockwise table traversal instead of registration order', () => {
    let state = createState({
      status: GameStatus.Day,
      rules: { isSheriffElectionEnabled: true },
      roleRevealRandomNonce: 'game-2',
      isAudioPlaying: false,
      sheriffElection: {
        phase: 'registration',
        registeredSeats: [],
        withdrawnSeats: [],
        completedRounds: [],
      },
    });

    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.register' },
      userContext('host'),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.register' },
      userContext('host', 2),
    );
    state = evolveCommittedCommand(
      state,
      { type: 'werewolf.sheriff.advance' },
      userContext('host'),
    );

    expect(state.sheriffElection).toMatchObject({
      phase: 'candidateSpeech',
      registeredSeats: [0, 2],
      speakingOrder: [2, 0],
    });
  });

  it('rejects runoff withdrawal from a registered candidate who did not tie', () => {
    const state = createState({
      status: GameStatus.Day,
      rules: { isSheriffElectionEnabled: true },
      sheriffElection: {
        phase: 'runoffSpeech',
        registeredSeats: [0, 1, 2],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0, 2],
        speakingOrder: [0, 2],
      },
    });

    expect(
      werewolfEngine.decide(state, { type: 'werewolf.sheriff.withdraw' }, userContext('user-1')),
    ).toEqual({ kind: 'reject', reason: 'not_candidate' });
  });

  it.each<{
    command: WerewolfCommand;
    context: CommandContext;
    election: SheriffElectionState;
  }>([
    {
      command: { type: 'werewolf.sheriff.register' },
      context: userContext('user-1'),
      election: {
        phase: 'registration',
        registeredSeats: [],
        withdrawnSeats: [],
        completedRounds: [],
      },
    },
    {
      command: { type: 'werewolf.sheriff.withdraw' },
      context: userContext('user-1'),
      election: {
        phase: 'registration',
        registeredSeats: [1],
        withdrawnSeats: [],
        completedRounds: [],
      },
    },
    {
      command: { type: 'werewolf.sheriff.vote', targetSeat: 0 },
      context: userContext('user-1'),
      election: {
        phase: 'firstVote',
        registeredSeats: [0],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0],
        eligibleVoterSeats: [1, 2],
        ballots: {},
      },
    },
    {
      command: { type: 'werewolf.sheriff.advance' },
      context: userContext('host'),
      election: {
        phase: 'registration',
        registeredSeats: [],
        withdrawnSeats: [],
        completedRounds: [],
      },
    },
  ])(
    'rejects $command.type while the final night audio is playing',
    ({ command, context, election }) => {
      const state = createState({
        status: GameStatus.Day,
        rules: { isSheriffElectionEnabled: true },
        isAudioPlaying: true,
        sheriffElection: election,
      });

      expect(werewolfEngine.decide(state, command, context)).toEqual({
        kind: 'reject',
        reason: 'forbidden_while_audio_playing',
      });
    },
  );

  it('is deterministic for identical state, command, and execution context', () => {
    const state = createState({
      status: GameStatus.Seated,
      players: {
        0: { userId: 'host', seat: 0, hasViewedRole: false },
        1: { userId: 'user-1', seat: 1, hasViewedRole: false },
        2: { userId: 'user-2', seat: 2, hasViewedRole: false },
        3: { userId: 'user-3', seat: 3, hasViewedRole: false },
      },
    });
    const command = commandByType['werewolf.roles.assign'];
    const context = userContext('host');

    expect(werewolfEngine.decide(state, command, context)).toEqual(
      werewolfEngine.decide(state, command, context),
    );
  });
});
