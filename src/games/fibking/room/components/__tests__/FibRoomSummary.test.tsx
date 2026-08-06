/** FibKing room summary preparation-state rendering tests. */

import { render } from '@testing-library/react-native';

import { FibRoomSummary } from '../FibRoomSummary';

describe('FibRoomSummary', () => {
  it.each([
    ['preparing', '准备词语'],
    ['preparationFailed', '词语准备失败'],
  ] as const)('shows the authoritative %s phase without invented progress', (phase, label) => {
    const view = render(
      <FibRoomSummary
        phase={phase}
        occupiedSeatCount={4}
        playerCount={4}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.getByText(`${label} · 4/4 人就座`)).toBeTruthy();
    expect(view.queryByRole('progressbar')).toBeNull();
  });

  it('updates the phase summary when preparation completes', () => {
    const view = render(
      <FibRoomSummary
        phase="preparing"
        occupiedSeatCount={4}
        playerCount={4}
        onOpenRules={jest.fn()}
      />,
    );

    view.rerender(
      <FibRoomSummary
        phase="ongoing"
        occupiedSeatCount={4}
        playerCount={4}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.getByText('描述进行中 · 4/4 人就座')).toBeTruthy();
    expect(view.queryByText('准备词语 · 4/4 人就座')).toBeNull();
  });
});
