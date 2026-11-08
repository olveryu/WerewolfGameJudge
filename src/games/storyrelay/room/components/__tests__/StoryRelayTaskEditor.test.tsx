/**
 * Bot drafts stay independent per seat through the real room stage: taking
 * over another bot (FAB → takeover sheet) remounts the task editor
 * (StoryRelayStage keys it by authorSeat), and each seat reads/writes only
 * its own entry in the shared inputs map.
 */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { fireEvent, render } from '@testing-library/react-native';

import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';

import { StoryRelayStage } from '../StoryRelayStage';
import { StoryRelayTaskEditor } from '../StoryRelayTaskEditor';

/** Unseated host + 4 bot seats, round started, answering phase, no deadline. */
function botRoundState(): StoryRelayState {
  let commandNumber = 0;
  let state = storyRelayEngine.createInitialState(
    {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers: 4,
      writingDurationSeconds: null,
      transitionDurationSeconds: 0,
    },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: Parameters<typeof storyRelayEngine.decide>[1]) => {
    const decision = storyRelayEngine.decide(state, command, {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: 'round',
    });
    if (decision.kind === 'reject') throw new Error(decision.reason);
    state = decision.events.reduce(storyRelayEngine.evolve, state);
  };
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.game.begin' });
  if (state.phase !== 'answering') throw new Error('Expected the answering phase');
  return state;
}

describe('StoryRelayStage bot drafts', () => {
  it('keeps each taken-over bot seat on its own draft', () => {
    const state = botRoundState();
    const session = createFakeRoomLink<StoryRelayState, StoryRelayCommand>(
      readyLinkSnapshot(testIdentity('storyrelay'), createRoomSnapshot(state, 1)),
      async () => successfulRoomCommand(state),
    );

    const takeover = { effectiveSeat: 0, controlledSeat: null as number | null };
    const seatModel = {
      source: {
        count: 4,
        revision: 0,
        getSeat: (seat: number) => ({
          seat,
          player:
            seat < 2
              ? {
                  occupant: { kind: 'bot' as const, seat },
                  displayName: `机器人${seat}号`,
                }
              : null,
          isSelf: false,
          highlight: seat === takeover.controlledSeat ? 'controlled' : 'none',
          secondaryLabel: null,
          showReadyBadge: false,
          statusBadge: null,
          isStatusEmphasized: false,
          showLevel: false,
          decorationsEnabled: false,
        }),
      },
      visuallyDisabled: false,
      onSeatPress: () => {},
      onBotSeatLongPress: (seat: number) => {
        takeover.effectiveSeat = seat;
        takeover.controlledSeat = seat;
        view.rerender(stageElement());
      },
    } as unknown as RoomSeatBoardModel;
    const stageElement = () => (
      <StoryRelayStage
        state={state}
        effectiveSeat={takeover.effectiveSeat}
        controlledSeat={takeover.controlledSeat}
        releaseBot={() => {
          takeover.controlledSeat = null;
          view.rerender(stageElement());
        }}
        userId="host"
        isHost
        canControlBots
        seatModel={seatModel}
        session={session}
        submit={(label, command, options) =>
          session
            .dispatch(command, {
              controlledSeat: options?.controlledSeat ?? null,
              label,
              durable: false,
            })
            .then((outcome) => outcome.kind === 'committed')
        }
        isSubmitting={false}
        openReview={jest.fn()}
      />
    );
    const view = render(stageElement());

    // Opens the shared takeover sheet via the FAB and presses the takeover
    // button in the target seat's row (rows are ordered by seat here: all
    // bots are 'waiting' and there is no active seat).
    const takeOverSeatViaSheet = (seat: number) => {
      fireEvent.press(view.getByLabelText('机器人接管，有 2 个机器人'));
      const buttons = view.getAllByText('接管');
      const button = buttons[seat];
      if (button === undefined) throw new Error(`No takeover button for seat ${seat}`);
      fireEvent.press(button);
    };

    expect(view.getByText('我的稿件')).toBeTruthy();
    fireEvent.changeText(view.getByTestId('storyrelay-editor'), '机器人0的独立稿件');

    // Take over bot seat 1 through the real takeover UI: the stage remounts
    // the editor keyed by the new authorSeat, so seat 0's manuscript must
    // not leak into seat 1's editor.
    takeOverSeatViaSheet(1);
    expect(view.getByText('机器人2号的稿件')).toBeTruthy();
    expect(view.getByTestId('storyrelay-editor').props.value).toBe('');
    fireEvent.changeText(view.getByTestId('storyrelay-editor'), '机器人1的独立稿件');

    // Release (RoomShell banner in the real app), then take over seat 0
    // again: its own draft is restored, not seat 1's.
    takeover.controlledSeat = null;
    view.rerender(stageElement());
    takeOverSeatViaSheet(0);
    expect(view.getByTestId('storyrelay-editor').props.value).toBe('机器人0的独立稿件');
  });
});

/** Plays a 4-seat human round through the real engine to the answering phase of `targetStep`. */
function answeringStateAtStep(targetStep: number): StoryRelayState {
  let commandNumber = 0;
  let nowMs = 1000;
  let state = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const execution = () => ({
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'round',
  });
  const apply = (
    command: StoryRelayCommand,
    context: Parameters<typeof storyRelayEngine.decide>[2],
  ) => {
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(decision.reason);
    state = decision.events.reduce(storyRelayEngine.evolve, state);
  };
  const asSeat = (command: StoryRelayCommand, seat: number) =>
    apply(command, {
      actor: { kind: 'user', userId: seat === 0 ? 'host' : `u${seat}` },
      controlledSeat: null,
      ...execution(),
    });
  const taskOf = (seat: number) => {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) throw new Error(`seat ${seat} has no task`);
    return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
  };
  const settle = () => {
    if (state.deadlineAt === null) throw new Error(`no deadline in ${state.phase}`);
    nowMs = state.deadlineAt;
    apply(
      { type: 'storyrelay.phase.settleExpired' },
      { actor: { kind: 'system', effectId: 'effect:test' }, controlledSeat: null, ...execution() },
    );
  };
  for (let seat = 0; seat < 4; seat += 1) {
    asSeat({ type: 'room.seat.take', seat, profile: { displayName: `玩家${seat}` } }, seat);
  }
  asSeat({ type: 'storyrelay.game.begin' }, 0);
  for (let stepIndex = 0; stepIndex < targetStep; stepIndex += 1) {
    for (let seat = 0; seat < 4; seat += 1) {
      asSeat({ type: 'storyrelay.task.ready.set', ...taskOf(seat), isReady: true }, seat);
    }
    for (let seat = 0; seat < 4; seat += 1) {
      asSeat(
        { type: 'storyrelay.text.submit', ...taskOf(seat), text: `第${stepIndex + 1}棒` },
        seat,
      );
    }
    settle();
  }
  if (state.phase !== 'answering' || state.stepIndex !== targetStep) {
    throw new Error(
      `expected answering step ${targetStep}, got ${state.phase} step ${state.stepIndex}`,
    );
  }
  return state;
}

describe('StoryRelayTaskEditor final step', () => {
  it.each([
    [0, '故事从这里开始', '故事开头'],
    [2, '写下接下来的故事', '故事续写'],
    [3, '写下故事的结局', '故事结局'],
  ])('shows the %s placeholder and label at step %s', (stepIndex, placeholder, label) => {
    const state = answeringStateAtStep(stepIndex);
    const task = getStoryRelayTaskForSeat(state, 0);
    if (task === null) throw new Error('seat 0 has no task');
    const view = render(
      <StoryRelayTaskEditor
        state={state}
        task={task}
        inputs={new Map()}
        controlledSeat={null}
        submit={jest.fn(async () => true)}
        isSubmitting={false}
        finalization="idle"
        isExpired={false}
      />,
    );
    const editor = view.getByTestId('storyrelay-editor');
    expect(editor.props.placeholder).toBe(placeholder);
    expect(editor.props.accessibilityLabel).toBe(label);
  });
});
