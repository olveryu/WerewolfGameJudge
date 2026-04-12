/**
 * NightProgressIndicator.test.tsx
 *
 * Tests for the night progress indicator component.
 */
import { render } from '@testing-library/react-native';

import { NightProgressIndicator } from '@/screens/RoomScreen/components/NightProgressIndicator';
import { createRoomScreenComponentStyles } from '@/screens/RoomScreen/components/styles';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

const mockStyles = createRoomScreenComponentStyles(colors).nightProgressIndicator;

describe('NightProgressIndicator', () => {
  it('should render step count correctly', () => {
    const { getByText } = render(
      <NightProgressIndicator currentStep={3} totalSteps={12} styles={mockStyles} />,
    );

    expect(getByText(/第3步 \/ 共12步/)).toBeTruthy();
  });

  it('should render role name when provided', () => {
    const roleName = 'test-role';
    const { getByText } = render(
      <NightProgressIndicator
        currentStep={5}
        totalSteps={10}
        currentRoleName={roleName}
        styles={mockStyles}
      />,
    );

    expect(getByText(/第5步 \/ 共10步/)).toBeTruthy();
    expect(getByText(roleName)).toBeTruthy();
  });

  it('should not render role name when not provided', () => {
    const roleName = 'test-role';
    const { queryByText, getByText } = render(
      <NightProgressIndicator currentStep={1} totalSteps={8} styles={mockStyles} />,
    );

    expect(getByText(/第1步 \/ 共8步/)).toBeTruthy();
    // Should not have any role text element
    expect(queryByText(roleName)).toBeNull();
  });

  it('should have correct testID', () => {
    const { getByTestId } = render(
      <NightProgressIndicator currentStep={1} totalSteps={5} styles={mockStyles} />,
    );

    expect(getByTestId(TESTIDS.nightProgressIndicator)).toBeTruthy();
  });

  it('should display first step correctly', () => {
    const roleName = 'test-role';
    const { getByText } = render(
      <NightProgressIndicator
        currentStep={1}
        totalSteps={12}
        currentRoleName={roleName}
        styles={mockStyles}
      />,
    );

    expect(getByText(/第1步 \/ 共12步/)).toBeTruthy();
    expect(getByText(roleName)).toBeTruthy();
  });

  it('should display last step correctly', () => {
    const roleName = 'test-role';
    const { getByText } = render(
      <NightProgressIndicator
        currentStep={12}
        totalSteps={12}
        currentRoleName={roleName}
        styles={mockStyles}
      />,
    );

    expect(getByText(/第12步 \/ 共12步/)).toBeTruthy();
    expect(getByText(roleName)).toBeTruthy();
  });

  it('should handle various total step counts', () => {
    const { getByText, rerender } = render(
      <NightProgressIndicator currentStep={3} totalSteps={5} styles={mockStyles} />,
    );

    expect(getByText(/第3步 \/ 共5步/)).toBeTruthy();

    rerender(<NightProgressIndicator currentStep={7} totalSteps={15} styles={mockStyles} />);
    expect(getByText(/第7步 \/ 共15步/)).toBeTruthy();
  });
});
