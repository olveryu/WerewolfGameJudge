/**
 * StageSettleRescue (D3 follow-up): the one host self-rescue display
 * for an overdue stage deadline. The overdue decision lives in
 * `useStageDeadline`; this pins the rendering only: nothing while the
 * countdown runs or without a deadline, nothing before the grace
 * elapses, the waiting sentence plus the retry button for the host
 * once overdue, and the waiting-for-host hint (never the button) for
 * non-hosts.
 */
import { fireEvent, render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';

import { StageSettleRescue } from '../StageSettleRescue';

function renderRescue(overrides: Partial<React.ComponentProps<typeof StageSettleRescue>> = {}) {
  const onRetry = jest.fn();
  const view = render(
    <StageSettleRescue
      remainingSeconds={0}
      isOverdue
      isHost
      isRetrying={false}
      onRetry={onRetry}
      waitingLabel="等待推进…"
      {...overrides}
    />,
  );
  return { view, onRetry };
}

describe('StageSettleRescue', () => {
  it('renders nothing without a deadline', () => {
    const { view } = renderRescue({ remainingSeconds: null, isOverdue: false });
    expect(view.queryByTestId(TESTIDS.stageSettleRescue)).toBeNull();
  });

  it('renders nothing while the countdown is running', () => {
    const { view } = renderRescue({ remainingSeconds: 12, isOverdue: false });
    expect(view.queryByTestId(TESTIDS.stageSettleRescue)).toBeNull();
  });

  it('renders nothing at zero before the grace elapses', () => {
    const { view } = renderRescue({ remainingSeconds: 0, isOverdue: false });
    expect(view.queryByTestId(TESTIDS.stageSettleRescue)).toBeNull();
  });

  it('shows the waiting sentence and the retry button to the host once overdue', () => {
    const { view, onRetry } = renderRescue();
    expect(view.getByTestId(TESTIDS.stageSettleRescue)).toHaveTextContent(/等待推进…/);
    fireEvent.press(view.getByTestId(TESTIDS.stageSettleRescueRetryButton));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the waiting-for-host hint and no button to non-hosts once overdue', () => {
    const { view } = renderRescue({ isHost: false });
    expect(view.getByTestId(TESTIDS.stageSettleRescue)).toHaveTextContent(/等待房主处理/);
    expect(view.queryByTestId(TESTIDS.stageSettleRescueRetryButton)).toBeNull();
  });

  it('shows the per-game retry label', () => {
    const { view } = renderRescue({ retryLabel: '重试收稿' });
    expect(view.getByTestId(TESTIDS.stageSettleRescueRetryButton)).toHaveTextContent(/重试收稿/);
  });
});
