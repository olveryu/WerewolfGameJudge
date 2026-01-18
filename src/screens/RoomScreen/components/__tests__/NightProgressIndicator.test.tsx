/**
 * NightProgressIndicator.test.tsx
 *
 * Tests for the night progress indicator component.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { NightProgressIndicator } from '../NightProgressIndicator';
import { TESTIDS } from '../../../../testids';

describe('NightProgressIndicator', () => {
  it('should render step count correctly', () => {
    const { getByText } = render(
      <NightProgressIndicator currentStep={3} totalSteps={12} />
    );

    expect(getByText('步骤 3/12')).toBeTruthy();
  });

  it('should render role name when provided', () => {
    const { getByText } = render(
      <NightProgressIndicator currentStep={5} totalSteps={10} currentRoleName="女巫" />
    );

    expect(getByText('步骤 5/10')).toBeTruthy();
    expect(getByText('女巫')).toBeTruthy();
  });

  it('should not render role name when not provided', () => {
    const { queryByText, getByText } = render(
      <NightProgressIndicator currentStep={1} totalSteps={8} />
    );

    expect(getByText('步骤 1/8')).toBeTruthy();
    // Should not have any role text element
    expect(queryByText('女巫')).toBeNull();
    expect(queryByText('狼人')).toBeNull();
  });

  it('should have correct testID', () => {
    const { getByTestId } = render(
      <NightProgressIndicator currentStep={1} totalSteps={5} />
    );

    expect(getByTestId(TESTIDS.nightProgressIndicator)).toBeTruthy();
  });

  it('should display first step correctly', () => {
    const { getByText } = render(
      <NightProgressIndicator currentStep={1} totalSteps={12} currentRoleName="魔术师" />
    );

    expect(getByText('步骤 1/12')).toBeTruthy();
    expect(getByText('魔术师')).toBeTruthy();
  });

  it('should display last step correctly', () => {
    const { getByText } = render(
      <NightProgressIndicator currentStep={12} totalSteps={12} currentRoleName="黑狼王" />
    );

    expect(getByText('步骤 12/12')).toBeTruthy();
    expect(getByText('黑狼王')).toBeTruthy();
  });

  it('should handle various total step counts', () => {
    const { getByText, rerender } = render(
      <NightProgressIndicator currentStep={3} totalSteps={5} />
    );

    expect(getByText('步骤 3/5')).toBeTruthy();

    rerender(<NightProgressIndicator currentStep={7} totalSteps={15} />);
    expect(getByText('步骤 7/15')).toBeTruthy();
  });
});
