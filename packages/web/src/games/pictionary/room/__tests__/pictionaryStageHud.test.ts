/**
 * createPictionaryStageHud: the information bar for answering, transition and settling, built
 * from real engine states — the relay step chip, the submission roster and the phase countdown.
 */

import {
  createPictionaryCommand,
  getPictionaryRelayStepCount,
  pictionaryEngine,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  buildPictionaryTestState,
  PICTIONARY_TEST_PLAYER_NAMES,
  playPictionaryTestRound,
} from '@/test-utils/pictionaryState';

import { createPictionarySeatDataSource } from '../pictionaryRoomAdapter';
import { createPictionaryStageHud } from '../pictionaryStageHud';

const STEP_COUNT = getPictionaryRelayStepCount(PICTIONARY_TEST_PLAYER_NAMES.length);

function hud(state: PictionaryState, remainingSeconds: number | null) {
  return createPictionaryStageHud({
    state,
    remainingSeconds,
    seats: createPictionarySeatDataSource({
      state,
      revision: 1,
      myUserId: 'host-1',
      controlledSeat: null,
    }),
  });
}

/** The host (seat 0) marks its task done through the real engine. */
function markHostReady(state: PictionaryState): PictionaryState {
  const decision = pictionaryEngine.decide(
    state,
    createPictionaryCommand(state, { type: 'pictionary.task.ready.set', isReady: true }, 0),
    {
      actor: { kind: 'user', userId: 'host-1' },
      controlledSeat: null,
      nowMs: 1,
      commandId: 'ready',
      randomSeed: 'ready',
    },
  );
  if (decision.kind === 'reject') throw new Error(decision.reason);
  return pictionaryEngine.normalize(decision.events.reduce(pictionaryEngine.evolve, state));
}

const SUBMISSION_ROSTER = {
  title: '提交情况',
  groupTitles: { acting: '作答中', pending: '还没交', done: '已交' },
  actingSeat: null,
  pendingLabel: '作答中',
  isUrgent: false,
} as const;

describe('createPictionaryStageHud', () => {
  it('is null outside the relay steps', () => {
    expect(hud(buildPictionaryTestState(), null)).toBeNull();
    expect(
      hud(playPictionaryTestRound({ stopAt: { stepIndex: STEP_COUNT - 1, phase: 'gallery' } }), 20),
    ).toBeNull();
    expect(hud(playPictionaryTestRound(), null)).toBeNull();
    expect(hud(playPictionaryTestRound({ abortAtStep: 1 }), null)).toBeNull();
  });

  it('shows the step, the submission roster and the prompt countdown on the opening step', () => {
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } });
    expect(hud(state, 30)).toEqual({
      chips: [{ key: 'step', label: `第 1/${STEP_COUNT} 棒`, detail: null, tone: 'neutral' }],
      roster: { ...SUBMISSION_ROSTER, chipLabel: '已交 0/4' },
      timer: { label: '出题', remainingSeconds: 30, totalSeconds: 45 },
    });
  });

  it('counts a seat that marked its task done', () => {
    const state = markHostReady(
      playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } }),
    );
    expect(hud(state, 30)?.roster?.chipLabel).toBe('已交 1/4');
  });

  it('labels the countdown by the kind of step', () => {
    const drawing = playPictionaryTestRound({ stopAt: { stepIndex: 1, phase: 'answering' } });
    expect(hud(drawing, 100)?.timer).toEqual({
      label: '作画',
      remainingSeconds: 100,
      totalSeconds: 120,
    });
    const guess = playPictionaryTestRound({ stopAt: { stepIndex: 2, phase: 'answering' } });
    expect(hud(guess, 40)?.timer).toEqual({
      label: '猜词',
      remainingSeconds: 40,
      totalSeconds: 45,
    });
  });

  it('reads 不限时 for an untimed step and fails fast when the deadline disagrees', () => {
    const answering = playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } });
    const untimed: PictionaryState = {
      ...answering,
      config: { ...answering.config, guessDurationSeconds: null },
    };
    expect(hud(untimed, null)?.timer).toEqual({
      label: '出题',
      remainingSeconds: null,
      totalSeconds: null,
    });
    expect(() => hud(untimed, 30)).toThrow(/disagrees/);
    expect(() => hud(answering, null)).toThrow(/disagrees/);
  });

  it('counts down the handoff without a roster', () => {
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'transition' } });
    expect(hud(state, 4)).toEqual({
      chips: [{ key: 'step', label: `第 1/${STEP_COUNT} 棒`, detail: null, tone: 'neutral' }],
      roster: null,
      timer: { label: '换棒', remainingSeconds: 4, totalSeconds: 5 },
    });
    expect(() => hud(state, null)).toThrow(/no remaining seconds/);
  });

  it('drops the countdown for a zero-second handoff', () => {
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'transition' } });
    const instant: PictionaryState = {
      ...state,
      config: { ...state.config, transitionDurationSeconds: 0 },
    };
    expect(hud(instant, 0)?.timer).toBeNull();
  });

  it('keeps the submission roster while collecting, with no countdown', () => {
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'settling' } });
    expect(hud(state, null)).toEqual({
      chips: [{ key: 'step', label: `第 1/${STEP_COUNT} 棒`, detail: null, tone: 'neutral' }],
      roster: { ...SUBMISSION_ROSTER, chipLabel: '已交 0/4' },
      timer: null,
    });
  });
});
