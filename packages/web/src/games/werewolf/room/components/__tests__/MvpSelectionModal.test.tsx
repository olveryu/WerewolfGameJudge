/** MVP selection interaction contract; does not exercise rewards or room transport. */
import { fireEvent, render, screen } from '@testing-library/react';

import { MvpSelectionModal } from '../MvpSelectionModal';

const participants = [
  { userId: 'player-1', seat: 0, displayName: '一号玩家', hasLeft: false },
  { userId: 'player-2', seat: 1, displayName: '', hasLeft: true },
];

describe('MvpSelectionModal', () => {
  it('selects a single candidate locally and submits only on confirmation', () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const props = {
      participants,
      goldenDraws: 0,
      isSubmitting: false,
      onSelect,
      onClose: vi.fn(),
    };
    const view = render(<MvpSelectionModal {...props} />);
    const confirm = () => screen.getByRole('button', { name: '确认 MVP' });

    expect(screen.getByRole('button', { name: '关闭 MVP 评选' })).toBeEnabled();
    expect(confirm()).toBeDisabled();
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getAllByRole('radio')[0]).toBeChecked();
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(screen.getAllByRole('radio')[0]).not.toBeChecked();
    expect(screen.getAllByRole('radio')[1]).toBeChecked();
    fireEvent.click(confirm());
    expect(onSelect).toHaveBeenCalledWith('player-2');

    view.rerender(<MvpSelectionModal {...props} isSubmitting />);
    expect(confirm()).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭 MVP 评选' })).toBeDisabled();
    fireEvent.click(confirm());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes without confirming a selected candidate', () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <MvpSelectionModal
        participants={participants}
        goldenDraws={0}
        isSubmitting={false}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.click(screen.getByRole('button', { name: '暂不评选' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
