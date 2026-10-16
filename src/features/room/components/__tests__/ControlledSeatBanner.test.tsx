import { fireEvent, render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { ControlledSeatBanner } from '../ControlledSeatBanner';
import { createRoomFeatureStyles } from '../styles';

const styles = createRoomFeatureStyles(colors).controlledSeatBanner;

describe('ControlledSeatBanner', () => {
  it('renders the controlled seat and releases through the shared callback', () => {
    const onRelease = jest.fn();
    const view = render(
      <ControlledSeatBanner
        model={{ seat: 3, displayName: '机器人4号', onRelease }}
        styles={styles}
      />,
    );

    expect(view.getByTestId(TESTIDS.controlledSeatBanner)).toHaveTextContent(
      /正在操控 4 号位（机器人4号）/,
    );
    fireEvent.press(view.getByTestId(TESTIDS.controlledSeatReleaseButton));
    expect(onRelease).toHaveBeenCalledTimes(1);
  });
});
