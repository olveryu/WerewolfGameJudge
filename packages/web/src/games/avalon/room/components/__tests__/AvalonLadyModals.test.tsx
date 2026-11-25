import { fireEvent, render } from '@testing-library/react';

import { AvalonLadyCheckConfirmModal } from '../AvalonLadyCheckConfirmModal';
import { AvalonLadyResultModal } from '../AvalonLadyResultModal';

describe('AvalonLadyCheckConfirmModal', () => {
  it('renders nothing without a target', () => {
    const { queryByText } = render(
      <AvalonLadyCheckConfirmModal targetSeat={null} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(queryByText(/^查验/)).toBeNull();
  });

  it('names the target and confirms the check', () => {
    const onConfirm = vi.fn();
    const { getByText } = render(
      <AvalonLadyCheckConfirmModal targetSeat={2} onConfirm={onConfirm} onClose={vi.fn()} />,
    );
    expect(getByText('查验3号？')).toBeTruthy();
    fireEvent.click(getByText('确定'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('AvalonLadyResultModal', () => {
  it('shows the checked faction and acknowledges it', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <AvalonLadyResultModal
        targetName="3 号 · 玩家3"
        faction="evil"
        requireConfirmation
        onClose={onClose}
      />,
    );
    expect(getByTestId('avalon-lady-result-text')).toHaveTextContent('3 号 · 玩家3 是坏人。');
    fireEvent.click(getByTestId('avalon-lady-result-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
