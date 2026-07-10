import { handlerError, handlerRejection, handlerSuccess } from '../../../engine/handlers/types';
import type { StateAction } from '../../../engine/reducer/types';
import { buildInitialGameState } from '../../../engine/state/buildInitialState';
import { GameStatus, type GameTemplate, type RoleId } from '../../../models';
import type { CommandContext, CreateGameContext } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
  REASON_SEAT_EMPTY,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../../platform/protocol/reasons';
import type { GameState } from '../../../protocol/types';
import { GAME_ENGINE_CATALOG } from '../../catalog';
import type { WerewolfCommand } from '../commands/types';
import { REASON_ACTION_INPUT_MISMATCH, resolveSubmitActionIntent } from '../domain/actionInput';
import { resolveEffectiveSeatActor, resolveSystemActor, resolveUserActor } from '../domain/actor';
import { handlerResultToDecision, translateHandlerSideEffects } from '../domain/decision';
import { getWerewolfLifecycle, werewolfEngine } from '../engine';

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
    payload: Record<string, unknown>;
  }>([
    {
      stepId: 'seerCheck',
      role: 'seer',
      input: { kind: 'target', target: 3 },
      payload: { seat: 1, role: 'seer', target: 3 },
    },
    {
      stepId: 'magicianSwap',
      role: 'magician',
      input: { kind: 'multiTarget', targets: [0, 3] },
      payload: { seat: 1, role: 'magician', target: null, extra: { targets: [0, 3] } },
    },
    {
      stepId: 'hunterConfirm',
      role: 'hunter',
      input: { kind: 'confirm', confirmed: true },
      payload: { seat: 1, role: 'hunter', target: null, extra: { confirmed: true } },
    },
    {
      stepId: 'witchAction',
      role: 'witch',
      input: { kind: 'witch', saveTarget: 0, poisonTarget: null },
      payload: {
        seat: 1,
        role: 'witch',
        target: 1,
        extra: { stepResults: { save: 0, poison: null } },
      },
    },
    {
      stepId: 'thiefChoose',
      role: 'thief',
      input: { kind: 'card', cardIndex: 1 },
      payload: { seat: 1, role: 'thief', target: null, extra: { cardIndex: 1 } },
    },
  ])('maps $input.kind into the existing handler intent', ({ stepId, role, input, payload }) => {
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

    expect(resolveSubmitActionIntent(state, 1, { kind: 'confirm', confirmed: true })).toEqual({
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

  it('translates ordered audio into state events and rejects unsupported effects', () => {
    expect(
      translateHandlerSideEffects([
        { type: 'SAVE_STATE' },
        { type: 'PLAY_AUDIO', audioKey: 'night' },
        { type: 'PLAY_AUDIO', audioKey: 'wolf', isEndAudio: true },
        { type: 'BROADCAST_STATE' },
      ]),
    ).toEqual([
      {
        type: 'SET_PENDING_AUDIO_EFFECTS',
        payload: {
          effects: [{ audioKey: 'night' }, { audioKey: 'wolf', isEndAudio: true }],
        },
      },
      { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
    ]);

    expect(() =>
      translateHandlerSideEffects([{ type: 'SEND_MESSAGE', message: 'unsupported' }]),
    ).toThrow('[FAIL-FAST] SEND_MESSAGE is not a Werewolf domain effect');
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
      input: { kind: 'target', target: null },
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
    'werewolf.audio.ack': { type: 'werewolf.audio.ack' },
    'werewolf.audio.gate': { type: 'werewolf.audio.gate', isPlaying: false },
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
    expect(GAME_ENGINE_CATALOG).toEqual({ werewolf: werewolfEngine });
  });

  it('exhaustively dispatches all 25 command discriminants', () => {
    const state = createState();
    const commands = Object.values(commandByType);
    expect(commands).toHaveLength(25);

    for (const command of commands) {
      const context =
        command.type === 'werewolf.growth.applyRosterLevels'
          ? systemContext()
          : userContext('host');
      expect(['commit', 'reject']).toContain(werewolfEngine.decide(state, command, context).kind);
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
    'werewolf.audio.ack',
    'werewolf.audio.gate',
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
      stateVersion: 1,
      roomCode: '9876',
      hostUserId: 'creator',
      status: GameStatus.Unseated,
    });
    expect(Object.keys(state.players)).toHaveLength(4);
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
    [GameStatus.Ended, 'ended'],
  ] as const)('derives %s as %s lifecycle', (status, lifecycle) => {
    expect(getWerewolfLifecycle(createState({ status }))).toBe(lifecycle);
  });

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
