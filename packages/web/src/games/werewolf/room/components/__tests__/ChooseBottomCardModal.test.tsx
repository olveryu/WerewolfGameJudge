import { render, screen } from '@testing-library/react';

import { TESTIDS } from '@/testids';

import { ChooseBottomCardModal } from '../ChooseBottomCardModal';

describe('ChooseBottomCardModal', () => {
  it('exposes indexed options and preserves disabled card semantics', () => {
    render(
      <ChooseBottomCardModal
        choice={{
          cards: [
            { roleId: 'villager', isSelectable: false, reason: '不可选择' },
            { roleId: 'wolf', isSelectable: true, reason: null },
          ],
          hint: '底牌含狼人阵营',
        }}
        confirmText="选择这张底牌"
        onChoose={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId(TESTIDS.chooseBottomCardModal)).toBeInTheDocument();
    const disabledOption = screen.getByTestId(TESTIDS.chooseBottomCardOption(0));
    expect(disabledOption.tagName).toBe('BUTTON');
    expect(disabledOption).toBeDisabled();
    const enabledOption = screen.getByTestId(TESTIDS.chooseBottomCardOption(1));
    expect(enabledOption.tagName).toBe('BUTTON');
    expect(enabledOption).toBeEnabled();
    expect(screen.getByText('不可选择')).toBeInTheDocument();
    expect(screen.getByText('底牌含狼人阵营')).toBeInTheDocument();
  });
});
