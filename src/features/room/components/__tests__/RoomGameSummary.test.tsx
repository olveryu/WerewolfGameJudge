/** Visible room guide entry contract; navigation remains owned by the game. */
import { fireEvent, render } from '@testing-library/react-native';

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
