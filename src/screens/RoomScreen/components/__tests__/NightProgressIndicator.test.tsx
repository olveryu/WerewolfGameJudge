/**
 * NightProgressIndicator.test.tsx
 *
 * Tests for the night progress indicator component.
 */
import { render } from '@testing-library/react-native';
import React from 'react';

import { NightProgressIndicator } from '@/screens/RoomScreen/components/NightProgressIndicator';
import { createRoomScreenComponentStyles } from '@/screens/RoomScreen/components/styles';
import { TESTIDS } from '@/testids';
import { themes } from '@/theme/themes';

const mockStyles = createRoomScreenComponentStyles(themes.light.colors).nightProgressIndicator;

describe('NightProgressIndicator', () => {
  it('should render step count correctly', () => {
    const { getByText } = render(
      <NightProgressIndicator currentStep={3} totalSteps={12} styles={mockStyles} />,
    );

    expect(getByText(/3\/12/)).toBeTruthy();
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

    expect(getByText(/5\/10/)).toBeTruthy();
    expect(getByText(roleName)).toBeTruthy();
  });

  it('should not render role name when not provided', () => {
    const roleName = 'test-role';
    const { queryByText, getByText } = render(
      <NightProgressIndicator currentStep={1} totalSteps={8} styles={mockStyles} />,
    );

    expect(getByText(/1\/8/)).toBeTruthy();
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

    expect(getByText(/1\/12/)).toBeTruthy();
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

    expect(getByText(/12\/12/)).toBeTruthy();
    expect(getByText(roleName)).toBeTruthy();
  });

  it('should handle various total step counts', () => {
    const { getByText, rerender } = render(
      <NightProgressIndicator currentStep={3} totalSteps={5} styles={mockStyles} />,
    );

    expect(getByText(/3\/5/)).toBeTruthy();

    rerender(
      <NightProgressIndicator currentStep={7} totalSteps={15} styles={mockStyles} />,
    );
    expect(getByText(/7\/15/)).toBeTruthy();
  });
});
