/**
 * ContinueGameOverlay.test.tsx
 *
 * UI tests for the rejoin overlay component.
 * Verifies rendering, user interaction, and testID presence.
 */
import { fireEvent, render } from '@testing-library/react-native';

import { ContinueGameOverlay } from '@/screens/RoomScreen/components/ContinueGameOverlay';
import { createRoomScreenComponentStyles } from '@/screens/RoomScreen/components/styles';
import { TESTIDS } from '@/testids';
import { themes } from '@/theme/themes';

const mockStyles = createRoomScreenComponentStyles(themes.light.colors).continueGameOverlay;

describe('ContinueGameOverlay', () => {
  const onContinue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render title and message when visible', () => {
    const { getByText } = render(
      <ContinueGameOverlay visible={true} onContinue={onContinue} styles={mockStyles} />,
    );

    expect(getByText('游戏已恢复')).toBeTruthy();
    expect(getByText('点击下方按钮继续游戏并恢复音频')).toBeTruthy();
  });

  it('should render continue button with correct testID', () => {
    const { getByTestId } = render(
      <ContinueGameOverlay visible={true} onContinue={onContinue} styles={mockStyles} />,
    );

    expect(getByTestId(TESTIDS.continueGameButton)).toBeTruthy();
  });

  it('should call onContinue when button is pressed', () => {
    const { getByTestId } = render(
      <ContinueGameOverlay visible={true} onContinue={onContinue} styles={mockStyles} />,
    );

    fireEvent.press(getByTestId(TESTIDS.continueGameButton));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('should render button text with audio icon', () => {
    const { getByText } = render(
      <ContinueGameOverlay visible={true} onContinue={onContinue} styles={mockStyles} />,
    );

    expect(getByText('🔊 继续游戏')).toBeTruthy();
  });
});
