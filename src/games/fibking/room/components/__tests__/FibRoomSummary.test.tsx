/** FibKing room summary preparation-state rendering tests. */

import { render } from '@testing-library/react-native';

import { FibRoomSummary } from '../FibRoomSummary';

describe('FibRoomSummary', () => {
  it('shows an indeterminate progress bar only while preparing the round word', () => {
    const view = render(
      <FibRoomSummary
        phase="preparing"
        occupiedSeatCount={4}
        playerCount={4}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.getByLabelText('正在准备本轮词语')).toBeTruthy();

    view.rerender(
      <FibRoomSummary
        phase="ongoing"
        occupiedSeatCount={4}
        playerCount={4}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.queryByLabelText('正在准备本轮词语')).toBeNull();
  });
});
