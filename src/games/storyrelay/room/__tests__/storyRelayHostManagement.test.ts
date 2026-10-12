/**
 * createStoryRelayHostManagement characterization (AU-31): phase × host
 * snapshots from real engine states.
 */
import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  parseStoryRelayState,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';

import { createStoryRelayHostManagement } from '../storyRelayRoomAdapter';

type CommandContext = Parameters<typeof storyRelayEngine.decide>[2];

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

function build(state: StoryRelayState, isHost: boolean, isSetup: boolean) {
  return createStoryRelayHostManagement({
    state,
    isHost,
    capabilities: capabilities(isSetup),
    isSubmitting: false,
    submit,
  });
}

function session() {
  let nowMs = 1000;
  let commandNumber = 0;
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, transitionDurationSeconds: 0 },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const send = (command: StoryRelayCommand, controlledSeat: number | null = null) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat,
      nowMs,
      commandId: `command:${commandNumber++}`,
      randomSeed: 'round',
    };
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = parseStoryRelayState(
      JSON.parse(
        JSON.stringify(
          storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
        ),
      ),
    );
  };
  return {
    get state() {
      return state;
    },
    send,
    seatHost() {
      send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    },
    fillAndStart() {
      send({ type: 'room.seat.fillBots' });
      send({ type: 'storyrelay.round.start' });
    },
    finishStep() {
      send({ type: 'storyrelay.phase.finish', phaseRevision: state.phaseRevision });
      for (let seat = 0; seat < 4; seat += 1) {
        const task = getStoryRelayTaskForSeat(state, seat);
        if (task === null) throw new Error('Missing task');
        send(
          {
            type: 'storyrelay.text.submit',
            roundId: task.roundId,
            stepIndex: task.stepIndex,
            chainId: task.chainId,
            text: `第 ${task.stepIndex} 棒 ${seat} 号`,
          },
          seat === 0 ? null : seat,
        );
      }
    },
    expire() {
      if (state.deadlineAt === null) throw new Error('Missing deadline');
      nowMs = state.deadlineAt;
      send({ type: 'storyrelay.phase.expire', phaseRevision: state.phaseRevision });
    },
    playToGallery() {
      for (let step = 0; step < 4; step += 1) {
        this.finishStep();
        this.expire();
      }
    },
  };
}

describe('createStoryRelayHostManagement', () => {
  it('returns null for non-hosts', () => {
    const game = session();
    game.seatHost();
    expect(build(game.state, false, true)).toBeNull();
  });

  it('pins the lobby panel: start gated on a full room, room trio present', () => {
    const game = session();
    game.seatHost();
    const model = build(game.state, true, true);
    expect(model?.preview).toBe('开始游戏');
    expect(model?.status).toBe('等待入座 · 1/4');
    const start = model?.sections[0]?.actions[0];
    expect(start).toMatchObject({
      key: 'start-game',
      testID: 'start-game-button',
      isEnabled: false,
      disabledReason: '座位尚未坐满',
    });
    expect(model?.sections[1]?.actions.map((action) => action.key)).toEqual([
      'configure-game',
      'fill-bots',
      'clear-seats',
    ]);
    game.send({ type: 'room.seat.fillBots' });
    expect(build(game.state, true, true)?.sections[0]?.actions[0]).toMatchObject({
      isEnabled: true,
    });
  });

  it('pins the answering panel: finish-phase plus abort', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    expect(game.state.phase).toBe('answering');
    const model = build(game.state, true, false);
    expect(model?.preview).toBe('管理本局');
    expect(model?.sections.map((section) => section.key)).toEqual(['current-flow', 'danger']);
    expect(model?.sections[0]?.actions[0]).toMatchObject({
      key: 'finish-phase',
      label: '结束本棒',
      testID: 'storyrelay-finish-step',
    });
    expect(model?.sections[1]?.actions[0]).toMatchObject({ key: 'abort-round', label: '中止本局' });
  });

  it('keeps only the abort action outside answering while the round can abort', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.finishStep();
    expect(game.state.phase).toBe('transition');
    const model = build(game.state, true, false);
    expect(model?.sections.map((section) => section.key)).toEqual(['danger']);
  });

  it('pins the aborted terminal: return-lobby only, no next-round', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.send({ type: 'storyrelay.round.abort', phaseRevision: game.state.phaseRevision });
    expect(game.state.phase).toBe('aborted');
    const model = build(game.state, true, false);
    expect(model?.preview).toBe('未完成的故事');
    expect(model?.sections[0]?.actions.map((action) => action.key)).toEqual(['return-lobby']);
  });

  it('returns null in the gallery phase (no abort window)', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToGallery();
    expect(game.state.phase).toBe('gallery');
    expect(build(game.state, true, false)).toBeNull();
  });

  it('pins the ended terminal on the shared builders', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToGallery();
    game.send({ type: 'storyrelay.gallery.finish', phaseRevision: game.state.phaseRevision });
    expect(game.state.phase).toBe('ended');
    const model = build(game.state, true, false);
    expect(model?.preview).toBe('故事已揭晓');
    const actions = model?.sections[0]?.actions ?? [];
    expect(actions.map((action) => action.key)).toEqual(['next-round', 'return-lobby']);
    expect(actions.map((action) => action.testID)).toEqual([
      'next-round-button',
      'return-lobby-button',
    ]);
  });
});
