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
        bottomCards={['villager', 'wolf']}
        confirmText="选择这张底牌"
        disabledIndices={[0]}
        disabledHint="不可选择"
        subtitle="底牌含狼人阵营"
        onChoose={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByTestId(TESTIDS.chooseBottomCardModal)).toBeTruthy();
    expect(view.getByTestId(TESTIDS.chooseBottomCardOption(0)).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(view.getByTestId(TESTIDS.chooseBottomCardOption(1)).props.accessibilityState).toEqual({
      disabled: false,
    });
  });
});
