/** FibKing room summary preparation-state rendering tests. */

import { render } from '@testing-library/react-native';

import { FibRoomSummary } from '../FibRoomSummary';

describe('FibRoomSummary', () => {
  it.each([25, 50, 75])('shows authoritative %i%% preparation progress', (progressPercent) => {
    const view = render(
      <FibRoomSummary
        phase="preparing"
        occupiedSeatCount={4}
        playerCount={4}
        progressPercent={progressPercent}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.getByText(`${progressPercent}%`)).toBeTruthy();
    expect(view.getByLabelText('正在准备本轮词语').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: progressPercent,
    });
  });

  it('hides preparation progress outside the preparing phase', () => {
    const view = render(
      <FibRoomSummary
        phase="preparing"
        occupiedSeatCount={4}
        playerCount={4}
        progressPercent={75}
        onOpenRules={jest.fn()}
      />,
    );

    view.rerender(
      <FibRoomSummary
        phase="ongoing"
        occupiedSeatCount={4}
        playerCount={4}
        progressPercent={100}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.queryByLabelText('正在准备本轮词语')).toBeNull();
  });
});
