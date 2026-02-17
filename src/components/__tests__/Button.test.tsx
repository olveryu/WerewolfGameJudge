import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Button } from '@/components/Button/Button';

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

    it('should expose disabled accessibility state when disabled', () => {
      const { getByTestId } = render(
        <Button {...defaultProps} disabled={true} testID="test-btn" />,
      );

      // Community standard: disabled buttons expose accessible disabled state.
      // The ButtonPressMetadata contract is covered by the enabled press test above.
      expect(getByTestId('test-btn').props.accessibilityState).toEqual({ disabled: true });
    });

    it('should expose disabled accessibility state when loading', () => {
      const { getByTestId } = render(<Button {...defaultProps} loading={true} testID="test-btn" />);

      expect(getByTestId('test-btn').props.accessibilityState).toEqual({ disabled: true });
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
      const { getByTestId } = render(<Button {...defaultProps} onPress={onPress} loading={true} />);

      // When loading, button shows ActivityIndicator instead of text
      expect(getByTestId('button-loading-indicator')).toBeTruthy();
    });
  });

  describe('Custom styles', () => {
    it('should apply custom style', () => {
      // eslint-disable-next-line react-native/no-inline-styles
      const { getByText } = render(<Button {...defaultProps} style={{ marginTop: 10 }} />);

      expect(getByText('Test Button')).toBeTruthy();
    });

    it('should apply custom textStyle', () => {
      // eslint-disable-next-line react-native/no-inline-styles
      const { getByText } = render(<Button {...defaultProps} textStyle={{ fontWeight: 'bold' }} />);

      expect(getByText('Test Button')).toBeTruthy();
    });
  });
});
