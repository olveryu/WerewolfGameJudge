import { render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';

import { ChooseBottomCardModal } from '../ChooseBottomCardModal';

jest.mock('@/games/werewolf/assets/roleBadges', () => ({
  getRoleBadge: () => 1,
}));

describe('ChooseBottomCardModal', () => {
  it('exposes indexed options and preserves disabled card semantics', () => {
    const view = render(
      <ChooseBottomCardModal
        visible
        choice={{
          cards: [
            { roleId: 'villager', isSelectable: false, reason: '不可选择' },
            { roleId: 'wolf', isSelectable: true, reason: null },
          ],
          hint: '底牌含狼人阵营',
        }}
        confirmText="选择这张底牌"
        onChoose={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByTestId(TESTIDS.chooseBottomCardModal)).toBeTruthy();
    expect(view.getByTestId(TESTIDS.chooseBottomCardOption(0)).props.accessibilityRole).toBe(
      'button',
    );
    expect(view.getByTestId(TESTIDS.chooseBottomCardOption(0)).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(view.getByTestId(TESTIDS.chooseBottomCardOption(1)).props.accessibilityRole).toBe(
      'button',
    );
    expect(view.getByTestId(TESTIDS.chooseBottomCardOption(1)).props.accessibilityState).toEqual({
      disabled: false,
    });
    expect(view.getByText('不可选择')).toBeTruthy();
    expect(view.getByText('底牌含狼人阵营')).toBeTruthy();
  });
});
