/**
 * createStoryRelayHostManagement characterization (AU-31): phase × host
 * snapshots from real engine states; a finished round closes on the
 * shared review.
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
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { hostTaskBody } from '@/test-utils/hostTask';

import { createStoryRelayHostManagement } from '../storyRelayRoomAdapter';

type CommandContext = Parameters<typeof storyRelayEngine.decide>[2];

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
    requestTakeSeat: vi.fn(),
    requestMoveSeat: vi.fn(),
    leaveSeat: vi.fn(),
    kickSeat: vi.fn(),
    clearSeats: vi.fn(),
    fillBots: vi.fn(),
    configureGame: vi.fn(),
    shareRoom: vi.fn(),
  });
}

const submit = vi.fn(async () => true);

function build(state: StoryRelayState, isSetup: boolean, review: RoomReviewEntry | null = null) {
  return createStoryRelayHostManagement({
    state,
    capabilities: capabilities(isSetup),
    isSubmitting: false,
    submit,
    review,
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
  const sendSystem = (command: StoryRelayCommand) => {
    const context: CommandContext = {
      actor: { kind: 'system', effectId: 'effect:1' },
      controlledSeat: null,
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
      send({ type: 'storyrelay.game.begin' });
    },
    finishStep() {
      for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
        const task = getStoryRelayTaskForSeat(state, seat);
        if (task === null) throw new Error('Missing task');
        send(
          {
            type: 'storyrelay.task.ready.set',
            roundId: task.roundId,
            stepIndex: task.stepIndex,
            chainId: task.chainId,
            isReady: true,
          },
          seat === 0 ? null : seat,
        );
      }
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
    settle() {
      if (state.deadlineAt === null) throw new Error('Missing deadline');
      nowMs = state.deadlineAt;
      sendSystem({ type: 'storyrelay.phase.settleExpired' });
    },
    playToGallery() {
      for (let step = 0; step < 4; step += 1) {
        this.finishStep();
        this.settle();
      }
    },
  };
}

describe('createStoryRelayHostManagement', () => {
  it('pins the lobby panel: start gated on a full room, room trio present', () => {
    const game = session();
    game.seatHost();
    const model = build(game.state, true);
    const start = model?.sections[0]?.actions[0];
    expect(start).toMatchObject({
      key: 'start-game',
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
    game.send({ type: 'room.seat.fillBots' });
    expect(build(game.state, true)?.sections[0]?.actions[0]).toMatchObject({
      isEnabled: true,
    });
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

  it('keeps only abort during writing with no host advancement task', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    expect(game.state.phase).toBe('answering');
    const model = build(game.state, false);
    expect(model.task).toBeNull();
    expect(model.sections.map((section) => section.key)).toEqual(['danger']);
    expect(model.sections[0]!.actions.map((action) => action.key)).toEqual(['abort-game']);
  });

  it('keeps only the abort action outside answering while the round can abort', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.finishStep();
    expect(game.state.phase).toBe('transition');
    const model = build(game.state, false);
    expect(model?.sections.map((section) => section.key)).toEqual(['danger']);
  });

  it('pins the aborted terminal: the review beside return-lobby, no next-round', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.send({ type: 'storyrelay.game.abort', phaseRevision: game.state.phaseRevision });
    expect(game.state.phase).toBe('aborted');
    const model = build(game.state, false, { isEnabled: true, onPress: vi.fn() });
    expect(model?.sections[0]?.actions.map((action) => action.key)).toEqual([
      'review',
      'return-lobby',
    ]);
    expect(model.task).toEqual({ kind: 'choice', actionKeys: ['review', 'return-lobby'] });
  });

  it('keeps the host panel in the gallery phase with abort disabled and its reason', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToGallery();
    expect(game.state.phase).toBe('gallery');
    const model = build(game.state, false);
    expect(model.task).toBeNull();
    expect(model.sections.flatMap((section) => section.actions)).toMatchObject([
      { key: 'abort-game', isEnabled: false, disabledReason: '故事已完成，不能中止' },
    ]);
  });

  it('pins the ended terminal on the shared builders', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToGallery();
    game.send({ type: 'storyrelay.gallery.finish', phaseRevision: game.state.phaseRevision });
    expect(game.state.phase).toBe('ended');
    const openReview = vi.fn();
    const model = build(game.state, false, { isEnabled: true, onPress: openReview });
    const actions = model?.sections[0]?.actions ?? [];
    expect(actions.map((action) => action.key)).toEqual(['review', 'next-round', 'return-lobby']);
    expect(actions.map((action) => action.testID)).toEqual([
      'room-review-host-action',
      'next-round-button',
      'return-lobby-button',
    ]);
    const step = hostTaskBody(model);
    if (step?.kind !== 'choice') throw new Error('expected a choice task body');
    expect(step.actions.map((action) => action.label)).toEqual([
      '本局复盘',
      '再来一局',
      '返回大厅',
    ]);
    const [review] = step.actions;
    if (review?.isEnabled !== true) throw new Error('expected an enabled review action');
    review.onPress();
    expect(openReview).toHaveBeenCalledTimes(1);
  });

  it('fails fast when a finished round reaches the host panel without its review entry', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.send({ type: 'storyrelay.game.abort', phaseRevision: game.state.phaseRevision });
    expect(() => build(game.state, false)).toThrow(
      '[FAIL-FAST] Story Relay aborted host has no review entry',
    );
  });
});
