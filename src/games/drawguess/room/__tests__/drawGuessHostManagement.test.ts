/**
 * createDrawGuessHostManagement characterization (AU-31): phase × host
 * snapshots from real engine states, including the always-present
 * in-game panel added by ruling 8.
 */
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessCommand,
  drawGuessEngine,
  type DrawGuessState,
  type DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';

import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import { hostTaskBody } from '@/test-utils/hostTask';
import { showConfirmAlert } from '@/utils/alertPresets';

import { createDrawGuessHostManagement } from '../drawGuessRoomAdapter';

jest.mock('@/utils/alertPresets', () => ({ showConfirmAlert: jest.fn() }));

type CommandContext = Parameters<typeof drawGuessEngine.decide>[2];

const CHOICES: DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
];

function session() {
  let nowMs = 1000;
  let commandNumber = 0;
  let state: DrawGuessState = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const send = (command: DrawGuessCommand, userId = 'host', system = false) => {
    const base = {
      controlledSeat: null,
      nowMs,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const context: CommandContext = system
      ? { ...base, actor: { kind: 'system', effectId: 'effect:1' } }
      : { ...base, actor: { kind: 'user', userId } };
    const decision = drawGuessEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(drawGuessEngine.evolve, state);
  };
  const expire = () => {
    const phase = state.phase;
    if (
      (phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd') &&
      phase.deadlineAt !== null
    ) {
      nowMs = phase.deadlineAt;
    }
    send({
      type: 'drawguess.phase.expire',
      phaseRevision: state.phaseRevision,
      turnIndex: state.turnIndex,
    });
  };
  return {
    get state() {
      return state;
    },
    send,
    expire,
    seatHost() {
      send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    },
    fillAndStart() {
      send({ type: 'room.seat.fillBots' });
      send({ type: 'drawguess.game.begin' });
      send({ type: 'drawguess.words.dealt', turnIndex: 0, choices: CHOICES }, 'host', true);
    },
    playToEnd() {
      for (let step = 0; step < 60 && state.phase.kind !== 'ended'; step += 1) {
        expire();
        if (state.phase.kind === 'wordSelect') {
          send(
            { type: 'drawguess.words.dealt', turnIndex: state.turnIndex, choices: CHOICES },
            'host',
            true,
          );
        }
      }
    },
  };
}

function capabilities(
  isSetup: boolean,
): Pick<RoomCapabilities, 'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'> {
  return createRoomSetupCapabilities({
    isSetup,
    isHost: true,
    mySeat: 0,
    supportsBots: true,
    hasOccupiedSeats: true,
    isRoomFull: false,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    shareRoom: jest.fn(),
  });
}

const submit = jest.fn(async () => true);

function build(state: DrawGuessState, isSetup: boolean, isSubmitting = false) {
  return createDrawGuessHostManagement({
    state,
    capabilities: capabilities(isSetup),
    isSubmitting,
    submit,
  });
}

describe('createDrawGuessHostManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pins the lobby panel: start disabled until the room is full, room trio present', () => {
    const game = session();
    game.seatHost();
    const model = build(game.state, true);
    expect(model?.sections.map((section) => section.key)).toEqual(['game', 'room']);
    const start = model?.sections[0]?.actions[0];
    expect(start).toMatchObject({
      key: 'start-game',
      label: '开始游戏',
      testID: 'start-game-button',
      isEnabled: false,
      disabledReason: '座位尚未坐满（还差 3 人）',
    });
    expect(model?.sections[1]?.actions.map((action) => action.key)).toEqual([
      'configure-game',
      'fill-bots',
      'clear-seats',
      'share-room',
    ]);
  });

  it('enables start once the room is full', () => {
    const game = session();
    game.seatHost();
    game.send({ type: 'room.seat.fillBots' });
    const start = build(game.state, true)?.sections[0]?.actions[0];
    expect(start).toMatchObject({ key: 'start-game', isEnabled: true });
  });

  it('derives the task body from the lobby start gate', () => {
    const game = session();
    game.seatHost();
    const blocked = hostTaskBody(build(game.state, true));
    expect(blocked).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (blocked?.kind !== 'blocked') throw new Error('expected a blocked task body');
    expect(blocked.reason).toBe('座位尚未坐满（还差 3 人）');
    expect(blocked.remedy?.label).toBe('分享房间');

    game.send({ type: 'room.seat.fillBots' });
    const ready = hostTaskBody(build(game.state, true));
    if (ready?.kind !== 'ready') throw new Error('expected a ready task body');
  });

  it.each(['wordSelect', 'drawing', 'roundEnd'] as const)(
    'keeps the room section and offers only abort during %s',
    (phase) => {
      const game = session();
      game.seatHost();
      game.fillAndStart();
      if (phase !== 'wordSelect') game.expire();
      if (phase === 'roundEnd') game.expire();
      expect(game.state.phase.kind).toBe(phase);
      const model = build(game.state, false);
      expect(model.task).toBeNull();
      expect(model.sections.map((section) => section.key)).toEqual(['room', 'danger']);
      // Setup capabilities are all denied mid-game, exactly like Avalon.
      expect(model?.sections[0]?.actions).toEqual([]);
      expect(model.sections[1]!.actions).toMatchObject([
        { key: 'abort-game', label: '中止本局', isEnabled: true, variant: 'danger' },
      ]);
    },
  );

  it('submits the game-scoped abort only after confirmation', async () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    const action = build(game.state, false).sections[1]!.actions[0]!;
    if (!action.isEnabled) throw new Error('Expected enabled abort');
    action.onPress();
    expect(submit).not.toHaveBeenCalled();
    const confirmation = jest.mocked(showConfirmAlert).mock.calls[0];
    if (confirmation === undefined) throw new Error('Expected abort confirmation');
    expect(confirmation[0]).toBe('中止本局？');
    expect(confirmation[1]).toContain('本局不发完成奖励');
    await confirmation[2]();
    expect(submit).toHaveBeenCalledWith('中止本局', {
      type: 'drawguess.game.abort',
      gameSequence: game.state.gameSequence,
    });
  });

  it('disables abort while another command is submitting', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    const action = build(game.state, false, true).sections[1]!.actions[0]!;
    expect(action.isEnabled).toBe(false);
    expect(action).not.toHaveProperty('onPress');
  });

  it('pins the terminal panel on the shared next-round / return-lobby builders', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToEnd();
    expect(game.state.phase.kind).toBe('ended');
    const model = build(game.state, false);
    const actions = model?.sections[0]?.actions ?? [];
    expect(actions.map((action) => action.key)).toEqual(['next-round', 'return-lobby']);
    expect(actions.map((action) => action.testID)).toEqual([
      'next-round-button',
      'return-lobby-button',
    ]);
  });
});
