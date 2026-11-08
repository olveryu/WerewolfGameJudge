/**
 * Story Relay gallery renders through the shared album shell: the heading,
 * the bottom-follow text flow, the unified playback copy, and the ended
 * pager + share — driven by a real engine session to the gallery phase.
 */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { render } from '@testing-library/react-native';

import { StoryRelayGallery } from '../StoryRelayGallery';

/** Four humans play four turns; the state lands in the gallery phase. */
function galleryState(): StoryRelayState {
  let commandNumber = 0;
  let nowMs = 1000;
  let state = storyRelayEngine.createInitialState(
    {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers: 4,
      writingDurationSeconds: null,
      transitionDurationSeconds: 0,
      galleryItemDurationSeconds: 5,
    },
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
  for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
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
  if (state.phase !== 'gallery') throw new Error(`expected gallery, got ${state.phase}`);
  return state;
}

function endedState(): StoryRelayState {
  const state = galleryState();
  const decision = storyRelayEngine.decide(
    state,
    { type: 'storyrelay.gallery.finish', phaseRevision: state.phaseRevision },
    {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat: null,
      nowMs: 1000,
      commandId: 'command:finish',
      randomSeed: 'round',
    },
  );
  if (decision.kind === 'reject') throw new Error(decision.reason);
  const ended = decision.events.reduce(storyRelayEngine.evolve, state);
  if (ended.phase !== 'ended') throw new Error(`expected ended, got ${ended.phase}`);
  return ended;
}

const galleryElement = (
  state: StoryRelayState,
  isHost: boolean,
  remainingSeconds: number | null,
) => (
  <StoryRelayGallery
    state={state}
    isHost={isHost}
    submit={jest.fn(async () => true)}
    isSubmitting={false}
    openReview={jest.fn()}
    remainingSeconds={remainingSeconds}
    isOverdue={false}
    onRetrySettle={jest.fn()}
  />
);

describe('StoryRelayGallery', () => {
  it('shows the first revealed segment under the shared heading with the countdown', () => {
    const view = render(galleryElement(galleryState(), true, 82));
    expect(view.getByText('故事揭晓')).toBeTruthy();
    expect(view.getByText('第 1 / 4 篇')).toBeTruthy();
    expect(view.getByText('1:22')).toBeTruthy();
    expect(view.getByText('第1棒')).toBeTruthy();
  });

  it('uses the unified playback copy for the host', () => {
    const view = render(galleryElement(galleryState(), true, 82));
    expect(view.getByLabelText('上一项')).toBeTruthy();
    expect(view.getByLabelText('下一项')).toBeTruthy();
    expect(view.getByText('暂停')).toBeTruthy();
    expect(view.getByText('全部揭晓')).toBeTruthy();
    expect(view.queryByLabelText('上一段')).toBeNull();
    expect(view.queryByLabelText('下一段')).toBeNull();
    expect(view.queryByLabelText('继续回放')).toBeNull();
  });

  it('tells non-host players everyone is watching the same story', () => {
    const view = render(galleryElement(galleryState(), false, 82));
    expect(view.getByText('全员正在观看同一篇故事')).toBeTruthy();
  });

  it('offers the pager and share once the gallery ends', () => {
    const view = render(galleryElement(endedState(), true, null));
    expect(view.getByLabelText('上一篇故事')).toBeTruthy();
    expect(view.getByLabelText('下一篇故事')).toBeTruthy();
    expect(view.getByText('分享本篇故事')).toBeTruthy();
    expect(view.getByText('不限时')).toBeTruthy();
  });
});
