import { showAlert, setAlertListener, AlertConfig } from '@/utils/alert';

describe('alert utility', () => {
  afterEach(() => {
    // Reset listener after each test
    setAlertListener(null);
  });

  describe('setAlertListener', () => {
    it('should set the listener', () => {
      const mockListener = jest.fn();
      setAlertListener(mockListener);

      showAlert('Test', 'Message');

      expect(mockListener).toHaveBeenCalledWith({
        title: 'Test',
        message: 'Message',
        buttons: [{ text: '确定' }],
      });
    });

    it('should allow clearing the listener with null', () => {
      const mockListener = jest.fn();
      setAlertListener(mockListener);
      setAlertListener(null);

      // Should not throw when listener is null
      // (will fall back to native alert)
      expect(() => showAlert('Test')).not.toThrow();
      expect(mockListener).not.toHaveBeenCalled();
    });
  });

  describe('showAlert', () => {
    it('should call listener with title only', () => {
      const mockListener = jest.fn();
      setAlertListener(mockListener);

      showAlert('Title Only');

      expect(mockListener).toHaveBeenCalledWith({
        title: 'Title Only',
        message: undefined,
        buttons: [{ text: '确定' }],
      });
    });

    it('should call listener with title and message', () => {
      const mockListener = jest.fn();
      setAlertListener(mockListener);

      showAlert('Title', 'This is a message');

      expect(mockListener).toHaveBeenCalledWith({
        title: 'Title',
        message: 'This is a message',
        buttons: [{ text: '确定' }],
      });
    });

    it('should call listener with custom buttons', () => {
      const mockListener = jest.fn();
      setAlertListener(mockListener);

      const buttons = [
        { text: 'Cancel', style: 'cancel' as const },
        { text: '确定', style: 'default' as const, onPress: jest.fn() },
      ];

      showAlert('Confirm', 'Are you sure?', buttons);

      expect(mockListener).toHaveBeenCalledWith({
        title: 'Confirm',
        message: 'Are you sure?',
        buttons,
      });
    });

    it('should call listener with destructive button', () => {
      const mockListener = jest.fn();
      setAlertListener(mockListener);

      const onDelete = jest.fn();
      showAlert('Delete', 'Delete this item?', [
        { text: 'Delete', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);

      expect(mockListener).toHaveBeenCalledWith({
        title: 'Delete',
        message: 'Delete this item?',
        buttons: [
          { text: 'Delete', style: 'destructive', onPress: onDelete },
          { text: 'Cancel', style: 'cancel' },
        ],
      });
    });
  });

  describe('AlertConfig type', () => {
    it('should have correct structure', () => {
      const config: AlertConfig = {
        title: 'Test',
        message: 'Message',
        buttons: [{ text: '确定' }],
      };

      expect(config.title).toBe('Test');
      expect(config.message).toBe('Message');
      expect(config.buttons).toHaveLength(1);
    });

    it('should allow optional message', () => {
      const config: AlertConfig = {
        title: 'Test',
        buttons: [{ text: '确定' }],
      };

      expect(config.message).toBeUndefined();
    });
  });
});
