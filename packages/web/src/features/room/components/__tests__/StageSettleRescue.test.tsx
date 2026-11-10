/**
 * StageSettleRescue (D3 follow-up): nothing while the countdown runs or
 * without a deadline, only the waiting sentence at zero before the grace
 * elapses, the retry button for the host once overdue, and the
 * waiting-for-host hint (never the button) for non-hosts.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { TESTIDS } from '@/testids';

import { StageSettleRescue } from '../StageSettleRescue';

function renderRescue(overrides: Partial<ComponentProps<typeof StageSettleRescue>> = {}) {
  const onRetry = vi.fn();
  render(
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
  return { onRetry };
}

describe('StageSettleRescue', () => {
  it('renders nothing without a deadline or while the countdown runs', () => {
    renderRescue({ remainingSeconds: null, isOverdue: false });
    expect(screen.queryByTestId(TESTIDS.stageSettleRescue)).toBeNull();
    renderRescue({ remainingSeconds: 12, isOverdue: false });
    expect(screen.queryByTestId(TESTIDS.stageSettleRescue)).toBeNull();
  });

  it('shows only the waiting sentence at zero before the grace elapses', () => {
    renderRescue({ isOverdue: false });
    expect(screen.getByTestId(TESTIDS.stageSettleRescue).textContent).toBe('等待推进…');
    expect(screen.queryByTestId(TESTIDS.stageSettleRescueRetryButton)).toBeNull();
  });

  it('gives the host the retry once overdue', () => {
    const { onRetry } = renderRescue({ retryLabel: '重试收稿' });
    const retry = screen.getByTestId(TESTIDS.stageSettleRescueRetryButton);
    expect(retry.textContent).toBe('重试收稿');
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows non-hosts the waiting-for-host hint and no button once overdue', () => {
    renderRescue({ isHost: false });
    expect(screen.getByTestId(TESTIDS.stageSettleRescue).textContent).toBe('等待推进…等待房主处理');
    expect(screen.queryByTestId(TESTIDS.stageSettleRescueRetryButton)).toBeNull();
  });
});
