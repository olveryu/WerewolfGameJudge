/** Visible room guide entry contract; navigation remains owned by the game. */
import { fireEvent, render, within } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';

import { Button } from '@/components/Button';

import { RoomDialog } from '../RoomDialog';
import { RoomGuideButton } from '../RoomGameSummary';

describe('RoomGuideButton', () => {
  it('exposes a visible text entry and dispatches navigation from the row', () => {
    const onPress = jest.fn();
    const view = render(<RoomGuideButton onPress={onPress} label="查看谁是卧底玩法说明" />);

    expect(view.getByText('玩法')).toBeVisible();
    expect(view.getByLabelText('查看谁是卧底玩法说明')).toHaveProp('accessibilityRole', 'button');
    fireEvent.press(view.getByLabelText('查看谁是卧底玩法说明'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('RoomDialog', () => {
  it('keeps actions outside the details scroller and forwards both close controls', () => {
    const onClose = jest.fn();
    const view = render(
      <RoomDialog
        title="身份详情"
        onClose={onClose}
        footer={<Button onPress={onClose}>知道了</Button>}
      >
        <Text>词语与释义</Text>
      </RoomDialog>,
    );
    const { UNSAFE_getByType: getByType } = view;
    const details = within(getByType(ScrollView));
    expect(details.getByText('词语与释义')).toBeVisible();
    expect(details.queryByText('知道了')).toBeNull();
    expect(details.queryByText('身份详情')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: '关闭详情' }));
    fireEvent.press(view.getByText('知道了'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
