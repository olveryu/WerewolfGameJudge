import { fireEvent, render, screen } from '@testing-library/react';

import { TESTIDS } from '@/testids';
import { alertStore, dismissAlert } from '@/utils/alert';

import { StepCardPicker } from '../StepCardPicker';

afterEach(() => {
  const alert = alertStore.getSnapshot();
  if (alert !== null) dismissAlert(alert.generation);
});

describe('StepCardPicker', () => {
  it('renders generic cards and reports an unavailable card reason', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <StepCardPicker
        title="选择卡牌"
        hint="选择一张"
        cards={[
          { index: 0, label: '不可用卡牌', unavailableReason: '该卡牌已使用' },
          { index: 1, label: '可用卡牌', unavailableReason: null },
        ]}
        onPick={onPick}
        onClose={onClose}
        onAlertShown={vi.fn()}
      />,
    );

    expect(screen.getByTestId(TESTIDS.stepCardPicker)).toHaveAccessibleName('选择卡牌');
    expect(screen.getByText('选择一张')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(TESTIDS.stepCardOption(0)));
    expect(alertStore.getSnapshot()?.message).toBe('该卡牌已使用');
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(TESTIDS.stepCardOption(1)));
    expect(onPick).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
