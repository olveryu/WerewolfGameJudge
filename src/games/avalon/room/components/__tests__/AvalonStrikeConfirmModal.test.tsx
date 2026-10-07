/** 刺杀二次确认走 AlertModal：指认 / 提前刺杀两套文案与回调。 */

import { fireEvent, render } from '@testing-library/react-native';

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
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(queryByText('指认梅林')).toBeNull();
  });

  it('confirms an accusation through AlertModal', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
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
    fireEvent.press(getByText('确认指认'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // AlertModal 在按钮回调后会自动关闭弹窗（再调一次 onClose），调用方保持幂等即可。
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms an early strike with the miss-warning copy', () => {
    const onConfirm = jest.fn();
    const confirmation: AvalonStrikeConfirmation = { seat: 2, mode: 'earlyStrike' };
    const { getByText } = render(
      <AvalonStrikeConfirmModal
        confirmation={confirmation}
        seatName="玩家3"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('提前刺杀')).toBeTruthy();
    expect(getByText('确定提前刺杀【玩家3】？刺错则好人直接获胜')).toBeTruthy();
    fireEvent.press(getByText('确认刺杀'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes on cancel', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <AvalonStrikeConfirmModal
        confirmation={{ seat: 2, mode: 'accuse' }}
        seatName="玩家3"
        onConfirm={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.press(getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });
});
