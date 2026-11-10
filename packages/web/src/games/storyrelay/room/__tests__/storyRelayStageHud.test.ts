/**
 * createStoryRelayStageHud: the information bar for answering, settling and transition, built
 * from real engine states — the passage chip, the readiness / collection roster and the phase
 * countdown.
 */

import {
  getStoryRelayTaskForSeat,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import {
  buildStoryRelayTestState,
  playStoryRelayTestRound,
  STORY_RELAY_TEST_PLAYER_NAMES,
} from '@/test-utils/storyrelayState';

import { createStoryRelaySeatDataSource } from '../storyRelayRoomAdapter';
import { createStoryRelayStageHud } from '../storyRelayStageHud';

const STEP_COUNT = STORY_RELAY_TEST_PLAYER_NAMES.length;

function hud(state: StoryRelayState, remainingSeconds: number | null) {
  return createStoryRelayStageHud({
    state,
    remainingSeconds,
    seats: createStoryRelaySeatDataSource({
      state,
      revision: 1,
      userId: 'host-1',
      controlledSeat: null,
    }),
  });
}

/** The host (seat 0) marks its passage ready through the real engine. */
function markHostReady(state: StoryRelayState): StoryRelayState {
  const task = getStoryRelayTaskForSeat(state, 0);
  if (task === null) throw new Error('The host has no task');
  const decision = storyRelayEngine.decide(
    state,
    {
      type: 'storyrelay.task.ready.set',
      roundId: task.roundId,
      stepIndex: task.stepIndex,
      chainId: task.chainId,
      isReady: true,
    },
    {
      actor: { kind: 'user', userId: 'host-1' },
      controlledSeat: null,
      nowMs: 1,
      commandId: 'ready',
      randomSeed: 'ready',
    },
  );
  if (decision.kind === 'reject') throw new Error(decision.reason);
  return storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state));
}

describe('createStoryRelayStageHud', () => {
  it('is null outside the relay steps', () => {
    expect(hud(buildStoryRelayTestState(), null)).toBeNull();
    expect(
      hud(playStoryRelayTestRound({ stopAt: { stepIndex: STEP_COUNT - 1, phase: 'gallery' } }), 5),
    ).toBeNull();
    expect(hud(playStoryRelayTestRound(), null)).toBeNull();
    expect(hud(playStoryRelayTestRound({ abortAtStep: 1 }), null)).toBeNull();
  });

  it('shows the passage, the readiness roster and the writing countdown', () => {
    const state = playStoryRelayTestRound({ stopAt: { stepIndex: 1, phase: 'answering' } });
    expect(hud(state, 80)).toEqual({
      chips: [{ key: 'step', label: `第 2/${STEP_COUNT} 段`, detail: null, tone: 'neutral' }],
      roster: {
        chipLabel: '准备 0/4',
        title: '准备情况',
        groupTitles: { acting: '写作中', pending: '还在写', done: '已准备' },
        actingSeat: null,
        pendingLabel: '写作中',
        isUrgent: false,
      },
      timer: { label: '写作', remainingSeconds: 80, totalSeconds: 90 },
    });
  });

  it('counts a seat that marked its passage ready', () => {
    const state = markHostReady(
      playStoryRelayTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } }),
    );
    expect(hud(state, 80)?.roster?.chipLabel).toBe('准备 1/4');
  });

  it('reads 不限时 for untimed writing and fails fast when the deadline disagrees', () => {
    const answering = playStoryRelayTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } });
    const untimed: StoryRelayState = {
      ...answering,
      config: { ...answering.config, writingDurationSeconds: null },
    };
    expect(hud(untimed, null)?.timer).toEqual({
      label: '写作',
      remainingSeconds: null,
      totalSeconds: null,
    });
    expect(() => hud(untimed, 30)).toThrow(/disagrees/);
    expect(() => hud(answering, null)).toThrow(/disagrees/);
  });

  it('switches to the collection roster while settling, with no countdown', () => {
    const state = playStoryRelayTestRound({ stopAt: { stepIndex: 0, phase: 'settling' } });
    expect(hud(state, null)).toEqual({
      chips: [{ key: 'step', label: `第 1/${STEP_COUNT} 段`, detail: null, tone: 'neutral' }],
      roster: {
        chipLabel: '收稿 0/4',
        title: '收稿情况',
        groupTitles: { acting: '待收稿', pending: '待收稿', done: '已收稿' },
        actingSeat: null,
        pendingLabel: '待收稿',
        isUrgent: false,
      },
      timer: null,
    });
  });

  it('counts down the handoff without a roster', () => {
    const state = playStoryRelayTestRound({ stopAt: { stepIndex: 0, phase: 'transition' } });
    expect(hud(state, 2)).toEqual({
      chips: [{ key: 'step', label: `第 1/${STEP_COUNT} 段`, detail: null, tone: 'neutral' }],
      roster: null,
      timer: { label: '换棒', remainingSeconds: 2, totalSeconds: 3 },
    });
    expect(() => hud(state, null)).toThrow(/no remaining seconds/);
  });

  it('drops the countdown for a zero-second handoff', () => {
    const state = playStoryRelayTestRound({ stopAt: { stepIndex: 0, phase: 'transition' } });
    const instant: StoryRelayState = {
      ...state,
      config: { ...state.config, transitionDurationSeconds: 0 },
    };
    expect(hud(instant, 0)?.timer).toBeNull();
  });
});
