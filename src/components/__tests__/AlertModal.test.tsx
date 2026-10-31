import { fireEvent, render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import { type AlertButton, AlertModal } from '@/components/AlertModal';
import { TESTIDS } from '@/testids';

describe('AlertModal', () => {
  const defaultProps = {
    visible: true,
    title: 'Test Title',
    buttons: [{ text: 'OK' }] as AlertButton[],
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('Loading buttons', () => {
    it('should render spinner and text together for an explicitly loading button', () => {
      const buttons: AlertButton[] = [
        { text: '生成中 1/3 段', loading: true },
        { text: '取消', style: 'cancel' },
      ];

      const { getByText, UNSAFE_getAllByType: getAllByType } = render(
        <AlertModal {...defaultProps} buttons={buttons} />,
      );

      // The label must stay visible next to the spinner — callers encode
      // progress in the text (e.g. "生成中 1/3 段"), so replacing the text
      // with a bare spinner hides the only progress signal.
      expect(getByText('生成中 1/3 段')).toBeTruthy();
      expect(getAllByType(ActivityIndicator)).toHaveLength(1);
      expect(getByText('取消')).toBeTruthy();
    });

    it('should render spinner and text together for a loading cancel button', () => {
      const buttons: AlertButton[] = [{ text: '取消', style: 'cancel', loading: true }];

      const { getByText, UNSAFE_getAllByType: getAllByType } = render(
        <AlertModal {...defaultProps} buttons={buttons} />,
      );

      expect(getByText('取消')).toBeTruthy();
      expect(getAllByType(ActivityIndicator)).toHaveLength(1);
    });

    it('should keep the pressed button text visible while its async onPress is pending', () => {
      const onClose = jest.fn();
      const onPress = jest.fn(() => new Promise<void>(() => undefined));
      const buttons: AlertButton[] = [{ text: '保存', onPress }];

      const { getByText, UNSAFE_getAllByType: getAllByType } = render(
        <AlertModal {...defaultProps} buttons={buttons} onClose={onClose} />,
      );

      fireEvent.press(getByText('保存'));

      expect(getByText('保存')).toBeTruthy();
      expect(getAllByType(ActivityIndicator)).toHaveLength(1);
      // Modal stays open while the promise is pending
      expect(onClose).not.toHaveBeenCalled();
    });

    it('keeps the pending state when the parent re-renders with a fresh buttons array', () => {
      const onPress = jest.fn(() => new Promise<void>(() => undefined));
      const renderButtons = (): AlertButton[] => [{ text: '保存', onPress }];

      const view = render(<AlertModal {...defaultProps} buttons={renderButtons()} />);
      fireEvent.press(view.getByText('保存'));
      view.rerender(<AlertModal {...defaultProps} buttons={renderButtons()} />);

      expect(view.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
      expect(view.getByTestId(TESTIDS.alertButton(0)).props.disabled).toBe(true);
    });

    it('starts clean on each opening', () => {
      const onPress = jest.fn(() => new Promise<void>(() => undefined));
      const buttons: AlertButton[] = [{ text: '保存', onPress }];

      const view = render(<AlertModal {...defaultProps} buttons={buttons} />);
      fireEvent.press(view.getByText('保存'));
      expect(view.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);

      view.rerender(<AlertModal {...defaultProps} buttons={buttons} visible={false} />);
      view.rerender(<AlertModal {...defaultProps} buttons={buttons} visible />);

      expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    });

    it('should not render a spinner for non-loading buttons', () => {
      const { UNSAFE_queryAllByType: queryAllByType } = render(<AlertModal {...defaultProps} />);

      expect(queryAllByType(ActivityIndicator)).toHaveLength(0);
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

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
