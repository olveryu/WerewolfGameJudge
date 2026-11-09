/** 刺杀二次确认走 AlertModal：指认 / 提前刺杀两套文案与回调。 */

import { fireEvent, render } from '@testing-library/react';

import {
  type AvalonStrikeConfirmation,
  AvalonStrikeConfirmModal,
} from '../AvalonStrikeConfirmModal';

describe('AvalonStrikeConfirmModal', () => {
  it('renders nothing without a confirmation', () => {
    const { queryByText } = render(
      <AvalonStrikeConfirmModal
        confirmation={null}
        seatName="玩家3"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(queryByText('指认梅林')).toBeNull();
  });

  it('confirms an accusation through the alert dialog', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const confirmation: AvalonStrikeConfirmation = { seat: 2, mode: 'accuse' };
    const { getByText } = render(
      <AvalonStrikeConfirmModal
        confirmation={confirmation}
        seatName="玩家3"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(getByText('指认梅林')).toBeTruthy();
    expect(getByText('确定指认【玩家3】为梅林？')).toBeTruthy();
    fireEvent.click(getByText('确认指认'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // 弹窗由房间状态驱动：确认只上报意图，关闭由调用方在 onConfirm 里清状态完成。
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirms an early strike with the miss-warning copy', () => {
    const onConfirm = vi.fn();
    const confirmation: AvalonStrikeConfirmation = { seat: 2, mode: 'earlyStrike' };
    const { getByText } = render(
      <AvalonStrikeConfirmModal
        confirmation={confirmation}
        seatName="玩家3"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    expect(getByText('提前刺杀')).toBeTruthy();
    expect(getByText('确定提前刺杀【玩家3】？刺错则好人直接获胜')).toBeTruthy();
    fireEvent.click(getByText('确认刺杀'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes on cancel', () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <AvalonStrikeConfirmModal
        confirmation={{ seat: 2, mode: 'accuse' }}
        seatName="玩家3"
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });
});
