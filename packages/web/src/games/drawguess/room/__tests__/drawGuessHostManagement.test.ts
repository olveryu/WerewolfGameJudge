/**
 * createDrawGuessHostManagement characterization (AU-31): phase × host
 * snapshots from real engine states, including the always-present
 * in-game panel added by ruling 8 and the ended panel that closes on
 * 本局复盘 / 再来一局 / 返回大厅.
 */
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessCommand,
  drawGuessEngine,
  type DrawGuessState,
  type DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';

import { confirmAction } from '@/features/room/confirm';
import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { hostTaskBody } from '@/test-utils/hostTask';

import { createDrawGuessHostManagement } from '../drawGuessRoomAdapter';

vi.mock('@/features/room/confirm', () => ({ confirmAction: vi.fn() }));

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
  const settle = () => {
    const phase = state.phase;
    if (
      (phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd') &&
      phase.deadlineAt !== null
    ) {
      nowMs = phase.deadlineAt;
    }
    send({ type: 'drawguess.phase.settleExpired' }, 'host', true);
  };
  return {
    get state() {
      return state;
    },
    send,
    settle,
    seatHost() {
      send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    },
    fillAndStart() {
      send({ type: 'room.seat.fillBots' });
      send({ type: 'drawguess.game.begin' });
      send(
        {
          type: 'drawguess.words.dealt',
          gameSequence: state.gameSequence,
          turnIndex: 0,
          choices: CHOICES,
        },
        'host',
        true,
      );
    },
    playToEnd() {
      for (let step = 0; step < 60 && state.phase.kind !== 'ended'; step += 1) {
        settle();
        if (state.phase.kind === 'wordSelect') {
          send(
            {
              type: 'drawguess.words.dealt',
              gameSequence: state.gameSequence,
              turnIndex: state.turnIndex,
              choices: CHOICES,
            },
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

function build(
  state: DrawGuessState,
  isSetup: boolean,
  isSubmitting = false,
  review: RoomReviewEntry | null = null,
) {
  return createDrawGuessHostManagement({
    state,
    capabilities: capabilities(isSetup),
    isSubmitting,
    submit,
    review,
  });
}

describe('createDrawGuessHostManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pins the lobby panel: start disabled until the room is full, room trio present', () => {
    const game = session();
    game.seatHost();
    const model = build(game.state, true);
    expect(model?.pendingActionKeys).toEqual(['start-game']);
    expect(model?.actions.map((action) => action.key)).toEqual([
      'start-game',
      'configure-game',
      'fill-bots',
      'clear-seats',
    ]);
    const start = model?.actions[0];
    expect(start).toMatchObject({
      key: 'start-game',
      label: '开始游戏',
      testID: 'start-game-button',
      state: { kind: 'blocked', reason: '座位尚未坐满（还差 3 人）' },
    });
  });

  it('enables start once the room is full', () => {
    const game = session();
    game.seatHost();
    game.send({ type: 'room.seat.fillBots' });
    const start = build(game.state, true)?.actions[0];
    expect(start).toMatchObject({ key: 'start-game', state: { kind: 'ready' } });
  });

  it('derives the task body from the lobby start gate', () => {
    const game = session();
    game.seatHost();
    const blocked = hostTaskBody(build(game.state, true));
    expect(blocked).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (blocked?.kind !== 'action') throw new Error('expected an action task body');
    expect(blocked.action.state).toEqual({
      kind: 'blocked',
      reason: '座位尚未坐满（还差 3 人）',
    });

    game.send({ type: 'room.seat.fillBots' });
    const ready = hostTaskBody(build(game.state, true));
    if (ready?.kind !== 'action' || ready.action.state.kind !== 'ready')
      throw new Error('expected a ready action task body');
  });

  it.each(['wordSelect', 'drawing', 'roundEnd'] as const)(
    'keeps the room section and offers only restart during %s',
    (phase) => {
      const game = session();
      game.seatHost();
      game.fillAndStart();
      if (phase !== 'wordSelect') game.settle();
      if (phase === 'roundEnd') game.settle();
      expect(game.state.phase.kind).toBe(phase);
      const model = build(game.state, false);
      expect(model.task).toBeNull();
      expect(model.actions).toMatchObject([
        { key: 'restart', label: '重新开始', category: 'danger', state: { kind: 'ready' } },
      ]);
    },
  );

  it('submits the game-scoped restart only after confirmation', async () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    const action = build(game.state, false).actions[0]!;
    if (action.state.kind !== 'ready') throw new Error('Expected enabled abort');
    action.state.onPress();
    expect(submit).not.toHaveBeenCalled();
    const confirmation = vi.mocked(confirmAction).mock.calls[0]?.[0];
    if (confirmation === undefined) throw new Error('Expected abort confirmation');
    expect(confirmation).toMatchObject({
      label: '重新开始？',
      tone: 'danger',
      confirmText: '重新开始',
    });
    expect(confirmation.body).toContain('不结算战绩与奖励');
    await confirmation.onConfirm();
    expect(submit).toHaveBeenCalledWith(
      '重新开始',
      {
        type: 'drawguess.game.restart',
        gameSequence: game.state.gameSequence,
        expectedPhase: 'playing',
      },
      { actionKey: 'restart' },
    );
  });

  it('disables restart while another command is submitting', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    const action = build(game.state, false, true).actions[0]!;
    expect(action.state).toEqual({ kind: 'busy' });
  });

  it('offers optional review and a single restart after the game ends', async () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToEnd();
    expect(game.state.phase.kind).toBe('ended');
    const openReview = vi.fn();
    const model = build(game.state, false, false, { isEnabled: true, onPress: openReview });
    expect(model.task).toBeNull();
    const actions = model?.actions ?? [];
    expect(actions.map((action) => action.key)).toEqual(['review', 'restart']);
    expect(actions.map((action) => action.testID)).toEqual([
      'room-review-host-action',
      'restart-button',
    ]);
    const [review] = actions;
    expect(review).toMatchObject({ label: '本局复盘', state: { kind: 'ready' } });
    if (review === undefined || review.state.kind !== 'ready')
      throw new Error('expected an enabled review');
    review.state.onPress();
    expect(openReview).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    const restart = actions[1];
    if (restart === undefined || restart.state.kind !== 'ready')
      throw new Error('expected enabled restart');
    restart.state.onPress();
    const confirmation = vi.mocked(confirmAction).mock.calls[0]?.[0];
    if (confirmation === undefined) throw new Error('Expected restart confirmation');
    expect(confirmation).toMatchObject({ label: '重新开始？', tone: 'danger' });
    expect(confirmation.body).toContain('已结算的战绩和奖励保留');
    expect(confirmation.body).toContain('可能无法查看复盘');
    await confirmation.onConfirm();
    expect(submit).toHaveBeenCalledWith(
      '重新开始',
      {
        type: 'drawguess.game.restart',
        gameSequence: game.state.gameSequence,
        expectedPhase: 'ended',
      },
      { actionKey: 'restart' },
    );
  });

  it('fails fast when the ended panel has no review entry', () => {
    const game = session();
    game.seatHost();
    game.fillAndStart();
    game.playToEnd();
    expect(() => build(game.state, false)).toThrow(
      '[FAIL-FAST] DrawGuess ended without a review entry',
    );
  });
});
