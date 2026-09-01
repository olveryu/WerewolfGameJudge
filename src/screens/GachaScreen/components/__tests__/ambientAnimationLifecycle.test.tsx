import { render } from '@testing-library/react-native';
import { cancelAnimation } from 'react-native-reanimated';

import { DrawButton } from '../DrawButton';
import { PityProgressBar } from '../PityProgressBar';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  cancelAnimation: jest.fn(),
}));

const mockCancelAnimation = jest.mocked(cancelAnimation);

beforeEach(() => {
  mockCancelAnimation.mockClear();
});

describe('gacha ambient animation lifecycle', () => {
  it('cancels the draw-button shimmer when the button becomes disabled', () => {
    const { rerender } = render(
      <DrawButton
        label="抽 ×10"
        disabled={false}
        onPress={jest.fn()}
        reducedMotion={false}
        isAnimationActive
      />,
    );

    rerender(
      <DrawButton
        label="抽 ×10"
        disabled
        onPress={jest.fn()}
        reducedMotion={false}
        isAnimationActive
      />,
    );

    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
  });

  it('cancels the pity pulse when the screen loses focus', () => {
    const { rerender } = render(
      <PityProgressBar pity={8} threshold={10} reducedMotion={false} isAnimationActive />,
    );

    rerender(
      <PityProgressBar pity={8} threshold={10} reducedMotion={false} isAnimationActive={false} />,
    );

    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
  });
});
