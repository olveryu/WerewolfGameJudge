import { getWerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';
import type { StepPresentation } from '@game-judge/game-engine/platform/steps';
import { renderHook } from '@testing-library/react';

import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { useWerewolfNightInteraction } from '../useWerewolfNightInteraction';

const STATE = buildWerewolfTestState();
const STEP: StepPresentation = {
  stepId: 'vote',
  serial: 1,
  title: '投票',
  isActor: true,
  message: null,
  actions: [],
  pendingResult: null,
  progress: { done: 1, total: 2 },
  deadlineMs: null,
};

function renderNight(step: StepPresentation, isSuspended = false) {
  const viewModel = {
    ...getWerewolfViewModel(STATE, { seat: null, isHost: true }),
    step,
    stepProgressKind: 'vote' as const,
  };
  return renderHook(() =>
    useWerewolfNightInteraction({
      state: STATE,
      viewModel,
      userId: 'user',
      roomId: 'room',
      effectiveSeat: 0,
      controlledSeat: null,
      submit: vi.fn().mockResolvedValue(true),
      isSuspended,
      hasPendingCommand: false,
      nowMs: 10_000,
    }),
  );
}

describe('Werewolf step progress', () => {
  it('shows the confirmed vote count to an actor', () => {
    expect(renderNight(STEP).result.current.actionMessage).toBe('已投 1/2');
  });

  it('keeps the settlement countdown visible while actions are suspended', () => {
    const result = renderNight({ ...STEP, deadlineMs: 14_200 }, true);
    expect(result.result.current.nightStatusLine).toBe('已全部投票，5 秒后结算（可改票或撤回）');
  });

  it('does not disclose vote progress to a non-actor', () => {
    const result = renderNight({ ...STEP, isActor: false });
    expect(result.result.current.actionMessage).toBeNull();
    expect(result.result.current.nightStatusLine).toBeNull();
  });
});
