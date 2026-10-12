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

import { createDrawGuessHostManagement } from '../drawGuessRoomAdapter';

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
      send({ type: 'drawguess.round.start' });
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
): Pick<RoomCapabilities, 'canConfigureGame' | 'canFillBots' | 'canClearSeats'> {
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

function build(state: DrawGuessState, isHost: boolean, isSetup: boolean) {
  return createDrawGuessHostManagement({
    state,
    isHost,
    capabilities: capabilities(isSetup),
    isSubmitting: false,
    submit,
  });
}

describe('createDrawGuessHostManagement', () => {
  it('returns null for non-hosts', () => {
    const game = session();
    game.seatHost();
    expect(build(game.state, false, true)).toBeNull();
  });

  it('pins the lobby panel: start disabled until the room is full, room trio present', () => {
    const game = session();
    game.seatHost();
    const model = build(game.state, true, true);
    expect(model?.preview).toBe('开始游戏');
    expect(model?.status).toBe('等待入座 · 1/4');
    expect(model?.sections.map((section) => section.key)).toEqual(['game', 'room']);
    const start = model?.sections[0]?.actions[0];
    expect(start).toMatchObject({
      key: 'start-game',
      label: '开始游戏',
      testID: 'start-game-button',
      isEnabled: false,
      disabledReason: '座位尚未坐满',
    });
    expect(model?.sections[1]?.actions.map((action) => action.key)).toEqual([
      'configure-game',
      'fill-bots',
      'clear-seats',
    ]);
  });

  it('enables start once the room is full', () => {
    const game = session();
    game.seatHost();
    game.send({ type: 'room.seat.fillBots' });
    const start = build(game.state, true, true)?.sections[0]?.actions[0];
    expect(start).toMatchObject({ key: 'start-game', isEnabled: true });
  });

  it('keeps an always-present in-game panel with the room section (ruling 8)', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    expect(game.state.phase.kind).toBe('wordSelect');
    const model = build(game.state, true, false);
    expect(model?.preview).toBe('房主管理');
    expect(model?.status).toBeNull();
    expect(model?.sections.map((section) => section.key)).toEqual(['room']);
    // Setup capabilities are all denied mid-game, exactly like Avalon.
    expect(model?.sections[0]?.actions).toEqual([]);
  });

  it('pins the terminal panel on the shared next-round / return-lobby builders', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToEnd();
    expect(game.state.phase.kind).toBe('ended');
    const model = build(game.state, true, false);
    expect(model?.preview).toBe('本局已结束');
    const actions = model?.sections[0]?.actions ?? [];
    expect(actions.map((action) => action.key)).toEqual(['next-round', 'return-lobby']);
    expect(actions.map((action) => action.testID)).toEqual([
      'next-round-button',
      'return-lobby-button',
    ]);
  });
});
