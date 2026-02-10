import { fireEvent,render } from '@testing-library/react-native';

import { NumPad } from '@/components/NumPad';

describe('NumPad', () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    mockOnValueChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render all digit buttons (0-9)', () => {
      const { getByTestId } = render(<NumPad value="" onValueChange={mockOnValueChange} />);

      for (let i = 0; i <= 9; i++) {
        expect(getByTestId(`numpad-${i}`)).toBeTruthy();
      }
    });

    it('should render clear and delete buttons', () => {
      const { getByTestId, getByText } = render(
        <NumPad value="" onValueChange={mockOnValueChange} />,
      );

      expect(getByTestId('numpad-clear')).toBeTruthy();
      expect(getByTestId('numpad-del')).toBeTruthy();
      expect(getByText('C')).toBeTruthy();
      expect(getByText('⌫')).toBeTruthy();
    });
  });

  describe('Digit Input', () => {
    it('should append digit when pressing a number button', () => {
      const { getByTestId } = render(<NumPad value="" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-1'));
      expect(mockOnValueChange).toHaveBeenCalledWith('1');
    });

    it('should append digit to existing value', () => {
      const { getByTestId } = render(<NumPad value="12" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-3'));
      expect(mockOnValueChange).toHaveBeenCalledWith('123');
    });

    it('should not exceed maxLength (default 4)', () => {
      const { getByTestId } = render(<NumPad value="1234" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-5'));
      expect(mockOnValueChange).not.toHaveBeenCalled();
    });

    it('should respect custom maxLength', () => {
      const { getByTestId } = render(
        <NumPad value="12" onValueChange={mockOnValueChange} maxLength={2} />,
      );

      fireEvent.press(getByTestId('numpad-3'));
      expect(mockOnValueChange).not.toHaveBeenCalled();
    });

    it('should allow input when under maxLength', () => {
      const { getByTestId } = render(
        <NumPad value="12" onValueChange={mockOnValueChange} maxLength={6} />,
      );

      fireEvent.press(getByTestId('numpad-3'));
      expect(mockOnValueChange).toHaveBeenCalledWith('123');
    });
  });

  describe('Clear Button', () => {
    it('should clear all input when pressing C', () => {
      const { getByTestId } = render(<NumPad value="1234" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-clear'));
      expect(mockOnValueChange).toHaveBeenCalledWith('');
    });

    it('should work even when value is empty', () => {
      const { getByTestId } = render(<NumPad value="" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-clear'));
      expect(mockOnValueChange).toHaveBeenCalledWith('');
    });
  });

  describe('Delete Button', () => {
    it('should delete last digit when pressing backspace', () => {
      const { getByTestId } = render(<NumPad value="123" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-del'));
      expect(mockOnValueChange).toHaveBeenCalledWith('12');
    });

    it('should result in empty string when deleting single digit', () => {
      const { getByTestId } = render(<NumPad value="1" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-del'));
      expect(mockOnValueChange).toHaveBeenCalledWith('');
    });

    it('should do nothing when value is already empty', () => {
      const { getByTestId } = render(<NumPad value="" onValueChange={mockOnValueChange} />);

      fireEvent.press(getByTestId('numpad-del'));
      expect(mockOnValueChange).toHaveBeenCalledWith('');
    });
  });

  describe('Disabled State', () => {
    it('should not respond to digit press when disabled', () => {
      const { getByTestId } = render(
        <NumPad value="" onValueChange={mockOnValueChange} disabled />,
      );

      fireEvent.press(getByTestId('numpad-1'));
      expect(mockOnValueChange).not.toHaveBeenCalled();
    });

    it('should not respond to clear press when disabled', () => {
      const { getByTestId } = render(
        <NumPad value="123" onValueChange={mockOnValueChange} disabled />,
      );

      fireEvent.press(getByTestId('numpad-clear'));
      expect(mockOnValueChange).not.toHaveBeenCalled();
    });

    it('should not respond to delete press when disabled', () => {
      const { getByTestId } = render(
        <NumPad value="123" onValueChange={mockOnValueChange} disabled />,
      );

      fireEvent.press(getByTestId('numpad-del'));
      expect(mockOnValueChange).not.toHaveBeenCalled();
    });
  });

  describe('Full Flow (4-digit room code)', () => {
    it('should support entering a complete 4-digit code', () => {
      let currentValue = '';
      const updateValue = (newValue: string) => {
        currentValue = newValue;
      };

      const { getByTestId, rerender } = render(
        <NumPad value={currentValue} onValueChange={updateValue} />,
      );

      // Enter 1234
      fireEvent.press(getByTestId('numpad-1'));
      expect(currentValue).toBe('1');

      rerender(<NumPad value={currentValue} onValueChange={updateValue} />);
      fireEvent.press(getByTestId('numpad-2'));
      expect(currentValue).toBe('12');

      rerender(<NumPad value={currentValue} onValueChange={updateValue} />);
      fireEvent.press(getByTestId('numpad-3'));
      expect(currentValue).toBe('123');

      rerender(<NumPad value={currentValue} onValueChange={updateValue} />);
      fireEvent.press(getByTestId('numpad-4'));
      expect(currentValue).toBe('1234');

      // Should not accept 5th digit
      rerender(<NumPad value={currentValue} onValueChange={updateValue} />);
      fireEvent.press(getByTestId('numpad-5'));
      expect(currentValue).toBe('1234');
    });

    it('should support correction flow (delete + re-enter)', () => {
      let currentValue = '123';
      const updateValue = (newValue: string) => {
        currentValue = newValue;
      };

      const { getByTestId, rerender } = render(
        <NumPad value={currentValue} onValueChange={updateValue} />,
      );

      // Delete last digit
      fireEvent.press(getByTestId('numpad-del'));
      expect(currentValue).toBe('12');

      // Enter correct digit
      rerender(<NumPad value={currentValue} onValueChange={updateValue} />);
      fireEvent.press(getByTestId('numpad-9'));
      expect(currentValue).toBe('129');
    });
  });
});
