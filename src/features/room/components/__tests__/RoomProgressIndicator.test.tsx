/**
 * RoomProgressIndicator.test.tsx
 *
 * Tests for the shared room progress indicator component.
 */
import { render } from '@testing-library/react-native';

import { RoomProgressIndicator } from '@/features/room/components/RoomProgressIndicator';
import { createRoomFeatureStyles } from '@/features/room/components/styles';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

const mockStyles = createRoomFeatureStyles(colors).progressIndicator;

describe('RoomProgressIndicator', () => {
  it('should render step count correctly', () => {
    const { getByText } = render(
      <RoomProgressIndicator currentStep={3} totalSteps={12} styles={mockStyles} />,
    );

    expect(getByText(/第3步 \/ 共12步/)).toBeTruthy();
  });

  it('should render the game-owned label when provided', () => {
    const label = '当前步骤';
    const { getByText } = render(
      <RoomProgressIndicator
        currentStep={5}
        totalSteps={10}
        currentLabel={label}
        styles={mockStyles}
      />,
    );

    expect(getByText(/第5步 \/ 共10步/)).toBeTruthy();
    expect(getByText(label)).toBeTruthy();
  });

  it('should not render a label when one is not provided', () => {
    const label = '当前步骤';
    const { queryByText, getByText } = render(
      <RoomProgressIndicator currentStep={1} totalSteps={8} styles={mockStyles} />,
    );

    expect(getByText(/第1步 \/ 共8步/)).toBeTruthy();
    expect(queryByText(label)).toBeNull();
  });

  it('should have correct testID', () => {
    const { getByTestId } = render(
      <RoomProgressIndicator currentStep={1} totalSteps={5} styles={mockStyles} />,
    );

    expect(getByTestId(TESTIDS.roomProgressIndicator)).toBeTruthy();
  });

  it('should display first step correctly', () => {
    const label = '当前步骤';
    const { getByText } = render(
      <RoomProgressIndicator
        currentStep={1}
        totalSteps={12}
        currentLabel={label}
        styles={mockStyles}
      />,
    );

    expect(getByText(/第1步 \/ 共12步/)).toBeTruthy();
    expect(getByText(label)).toBeTruthy();
  });

  it('should display last step correctly', () => {
    const label = '当前步骤';
    const { getByText } = render(
      <RoomProgressIndicator
        currentStep={12}
        totalSteps={12}
        currentLabel={label}
        styles={mockStyles}
      />,
    );

    expect(getByText(/第12步 \/ 共12步/)).toBeTruthy();
    expect(getByText(label)).toBeTruthy();
  });

  it('should handle various total step counts', () => {
    const { getByText, rerender } = render(
      <RoomProgressIndicator currentStep={3} totalSteps={5} styles={mockStyles} />,
    );

    expect(getByText(/第3步 \/ 共5步/)).toBeTruthy();

    rerender(<RoomProgressIndicator currentStep={7} totalSteps={15} styles={mockStyles} />);
    expect(getByText(/第7步 \/ 共15步/)).toBeTruthy();
  });
});
