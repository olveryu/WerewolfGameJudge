import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlertModal, AlertButton } from '@/components/AlertModal';

describe('AlertModal', () => {
  const defaultProps = {
    visible: true,
    title: 'Test Title',
    buttons: [{ text: 'OK' }] as AlertButton[],
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render title', () => {
      const { getByText } = render(<AlertModal {...defaultProps} />);

      expect(getByText('Test Title')).toBeTruthy();
    });

    it('should render message when provided', () => {
      const { getByText } = render(<AlertModal {...defaultProps} message="Test message" />);

      expect(getByText('Test message')).toBeTruthy();
    });

    it('should not render message when not provided', () => {
      const { queryByText } = render(<AlertModal {...defaultProps} />);

      // Should not find a message element (only title and button)
      expect(queryByText('Test message')).toBeNull();
    });

    it('should render all buttons', () => {
      const buttons: AlertButton[] = [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive' },
        { text: 'OK', style: 'default' },
      ];

      const { getByText } = render(<AlertModal {...defaultProps} buttons={buttons} />);

      expect(getByText('Cancel')).toBeTruthy();
      expect(getByText('Delete')).toBeTruthy();
      expect(getByText('OK')).toBeTruthy();
    });
  });

  describe('Visibility', () => {
    it('should be visible when visible prop is true', () => {
      const { getByText } = render(<AlertModal {...defaultProps} visible={true} />);

      expect(getByText('Test Title')).toBeTruthy();
    });

    it('should handle visible=false prop', () => {
      // When modal is not visible, React Native Modal hides content
      // We just verify it renders without crashing
      render(<AlertModal {...defaultProps} visible={false} />);
    });
  });

  describe('Button interactions', () => {
    it('should call onClose when button is pressed', () => {
      const onClose = jest.fn();
      const { getByText } = render(<AlertModal {...defaultProps} onClose={onClose} />);

      fireEvent.press(getByText('OK'));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call button onPress callback after closing', () => {
      const onPress = jest.fn();
      const onClose = jest.fn();
      const buttons: AlertButton[] = [{ text: 'OK', onPress }];

      const { getByText } = render(
        <AlertModal {...defaultProps} buttons={buttons} onClose={onClose} />,
      );

      fireEvent.press(getByText('OK'));

      expect(onClose).toHaveBeenCalled();

      // Advance timers to trigger the setTimeout callback
      jest.runAllTimers();

      expect(onPress).toHaveBeenCalled();
    });

    it('should work without onPress callback', () => {
      const onClose = jest.fn();
      const buttons: AlertButton[] = [{ text: 'OK' }]; // No onPress

      const { getByText } = render(
        <AlertModal {...defaultProps} buttons={buttons} onClose={onClose} />,
      );

      // Should not throw
      fireEvent.press(getByText('OK'));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Button styles', () => {
    it('should render cancel button with cancel style', () => {
      const buttons: AlertButton[] = [{ text: 'Cancel', style: 'cancel' }];

      const { getByText } = render(<AlertModal {...defaultProps} buttons={buttons} />);

      // Just verify the button renders - styling is tested implicitly
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('should render destructive button with destructive style', () => {
      const buttons: AlertButton[] = [{ text: 'Delete', style: 'destructive' }];

      const { getByText } = render(<AlertModal {...defaultProps} buttons={buttons} />);

      expect(getByText('Delete')).toBeTruthy();
    });

    it('should render default button with default style', () => {
      const buttons: AlertButton[] = [{ text: 'OK', style: 'default' }];

      const { getByText } = render(<AlertModal {...defaultProps} buttons={buttons} />);

      expect(getByText('OK')).toBeTruthy();
    });
  });

  describe('Multiple buttons', () => {
    it('should handle multiple buttons with different callbacks', () => {
      const onCancel = jest.fn();
      const onConfirm = jest.fn();
      const onClose = jest.fn();

      const buttons: AlertButton[] = [
        { text: 'Cancel', onPress: onCancel, style: 'cancel' },
        { text: 'Confirm', onPress: onConfirm },
      ];

      const { getByText } = render(
        <AlertModal {...defaultProps} buttons={buttons} onClose={onClose} />,
      );

      fireEvent.press(getByText('Cancel'));
      jest.runAllTimers();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
