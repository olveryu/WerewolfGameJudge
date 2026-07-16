import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '@/components/Button';

describe('Button interaction contract', () => {
  it('dispatches an enabled action without compatibility metadata', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="action" onPress={onPress}>
        操作
      </Button>,
    );

    fireEvent.press(getByTestId('action'));

    expect(onPress).toHaveBeenCalledWith();
  });

  it('blocks the normal action while disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="action" disabled onPress={onPress}>
        操作
      </Button>,
    );

    fireEvent.press(getByTestId('action'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('dispatches only the explicit disabled feedback action', () => {
    const onPress = jest.fn();
    const onDisabledPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="action" disabled onPress={onPress} onDisabledPress={onDisabledPress}>
        操作
      </Button>,
    );

    fireEvent.press(getByTestId('action'));

    expect(onDisabledPress).toHaveBeenCalledWith();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('blocks every action while loading', () => {
    const onPress = jest.fn();
    const onDisabledPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="action" loading onPress={onPress} onDisabledPress={onDisabledPress}>
        操作
      </Button>,
    );

    fireEvent.press(getByTestId('action'));

    expect(onPress).not.toHaveBeenCalled();
    expect(onDisabledPress).not.toHaveBeenCalled();
  });
});
