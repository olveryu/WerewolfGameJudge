/** MVP selection interaction contract; does not exercise rewards or room transport. */
import { fireEvent, render } from '@testing-library/react-native';

import { createMvpSelectionStyles, MvpSelectionModal } from '../MvpSelectionModal';

const participants = [
  { userId: 'player-1', seat: 0, displayName: '一号玩家', hasLeft: false },
  { userId: 'player-2', seat: 1, displayName: '', hasLeft: true },
];

describe('MvpSelectionModal', () => {
  it('selects a single candidate locally and submits only on confirmation', () => {
    const onSelect = jest.fn().mockResolvedValue(undefined);
    const props = {
      participants,
      goldenDraws: 0,
      isSubmitting: false,
      onSelect,
      onClose: jest.fn(),
      styles: createMvpSelectionStyles(),
    };
    const view = render(<MvpSelectionModal {...props} />);
    const confirm = () => view.getByRole('button', { name: '确认 MVP' });

    expect(view.getByTestId('Ionicons-icon-close')).toBeTruthy();
    expect(confirm()).toBeDisabled();
    fireEvent.press(view.getAllByRole('radio')[0]!);
    expect(onSelect).not.toHaveBeenCalled();
    expect(view.getAllByRole('radio')[0]).toBeChecked();
    fireEvent.press(view.getAllByRole('radio')[1]!);
    expect(view.getAllByRole('radio')[0]).not.toBeChecked();
    expect(view.getAllByRole('radio')[1]).toBeChecked();
    fireEvent.press(confirm());
    expect(onSelect).toHaveBeenCalledWith('player-2');

    view.rerender(<MvpSelectionModal {...props} isSubmitting />);
    expect(confirm()).toBeDisabled();
    expect(view.getByRole('button', { name: '关闭 MVP 评选' })).toBeDisabled();
    fireEvent.press(confirm());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes without confirming a selected candidate', () => {
    const onSelect = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const view = render(
      <MvpSelectionModal
        participants={participants}
        goldenDraws={0}
        isSubmitting={false}
        onSelect={onSelect}
        onClose={onClose}
        styles={createMvpSelectionStyles()}
      />,
    );
    fireEvent.press(view.getAllByRole('radio')[0]!);
    fireEvent.press(view.getByRole('button', { name: '暂不评选' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
