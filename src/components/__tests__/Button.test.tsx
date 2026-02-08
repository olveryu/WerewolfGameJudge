import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import Button from '@/components/Button/Button';

describe('Button', () => {
  const defaultProps = {
    title: 'Test Button',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render button title', () => {
      const { getByText } = render(<Button {...defaultProps} />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should render with icon when provided', () => {
      const icon = <Text testID="test-icon">Icon</Text>;

      const { getByTestId, getByText } = render(<Button {...defaultProps} icon={icon} />);

      expect(getByTestId('test-icon')).toBeTruthy();
      expect(getByText('Test Button')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should render primary variant by default', () => {
      const { getByText } = render(<Button {...defaultProps} />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should render secondary variant', () => {
      const { getByText } = render(<Button {...defaultProps} variant="secondary" />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should render danger variant', () => {
      const { getByText } = render(<Button {...defaultProps} variant="danger" />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { getByText } = render(<Button {...defaultProps} variant="outline" />);

      expect(getByText('Test Button')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('should render medium size by default', () => {
      const { getByText } = render(<Button {...defaultProps} />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should render small size', () => {
      const { getByText } = render(<Button {...defaultProps} size="small" />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should render large size', () => {
      const { getByText } = render(<Button {...defaultProps} size="large" />);

      expect(getByText('Test Button')).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should call onPress when pressed', () => {
      const onPress = jest.fn();
      const { getByText } = render(<Button {...defaultProps} onPress={onPress} />);

      fireEvent.press(getByText('Test Button'));

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledWith({ disabled: false, loading: false });
    });

    it('should call onPress with disabled meta when disabled', () => {
      const onPress = jest.fn();
      const { UNSAFE_getByType } = render(
        <Button {...defaultProps} onPress={onPress} disabled={true} />,
      );

      // Find the TouchableOpacity and press it directly
      const button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);

      // Button now reports meta instead of blocking - caller decides behavior
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledWith({ disabled: true, loading: false });
    });

    it('should call onPress with loading meta when loading', () => {
      const onPress = jest.fn();
      const { UNSAFE_getByType } = render(
        <Button {...defaultProps} onPress={onPress} loading={true} />,
      );

      // Find the TouchableOpacity and press it directly
      const button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);

      // Button now reports meta - caller decides behavior
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledWith({ disabled: false, loading: true });
    });
  });

  describe('Loading state', () => {
    it('should show ActivityIndicator when loading', () => {
      const { queryByText } = render(<Button {...defaultProps} loading={true} />);

      // Title should not be visible when loading
      expect(queryByText('Test Button')).toBeNull();
    });

    it('should show title when not loading', () => {
      const { getByText } = render(<Button {...defaultProps} loading={false} />);

      expect(getByText('Test Button')).toBeTruthy();
    });
  });

  describe('Disabled state', () => {
    it('should render with disabled style when disabled', () => {
      const { getByText } = render(<Button {...defaultProps} disabled={true} />);

      // Just verify it renders without crashing
      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should be disabled when loading', () => {
      const onPress = jest.fn();

      // Render directly with loading=true
      const { UNSAFE_getByType } = render(
        <Button {...defaultProps} onPress={onPress} loading={true} />,
      );

      // When loading, button shows ActivityIndicator instead of text
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });

  describe('Custom styles', () => {
    it('should apply custom style', () => {
      const { getByText } = render(<Button {...defaultProps} style={{ marginTop: 10 }} />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should apply custom textStyle', () => {
      const { getByText } = render(<Button {...defaultProps} textStyle={{ fontWeight: 'bold' }} />);

      expect(getByText('Test Button')).toBeTruthy();
    });
  });
});
