/**
 * alert.web.test - Tests for alert.ts web fallback paths
 *
 * Tests the Platform.OS === 'web' branches in showAlert:
 * - Single button → window.alert
 * - Two buttons → window.confirm
 * - 3+ buttons → window.prompt
 * Also tests the alertListener mechanism.
 */

import { Platform } from 'react-native';

// Save original
const originalOS = Platform.OS;

beforeEach(() => {
  jest.resetModules();
  (Platform as unknown as Record<string, unknown>).OS = 'web';
});

afterEach(() => {
  (Platform as unknown as Record<string, unknown>).OS = originalOS;
});

describe('showAlert - listener mode', () => {
  it('calls listener when set', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    const listener = jest.fn();
    setAlertListener(listener);

    showAlert('标题', '消息');

    expect(listener).toHaveBeenCalledWith({
      title: '标题',
      message: '消息',
      buttons: [{ text: '确定' }],
    });

    // Cleanup
    setAlertListener(null);
  });

  it('passes custom buttons to listener', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    const listener = jest.fn();
    setAlertListener(listener);

    const buttons = [
      { text: '取消', style: 'cancel' as const },
      { text: '确定', onPress: jest.fn() },
    ];
    showAlert('确认', '确定要删除吗？', buttons);

    expect(listener).toHaveBeenCalledWith({
      title: '确认',
      message: '确定要删除吗？',
      buttons,
    });

    setAlertListener(null);
  });
});

describe('showAlert - web fallback (no listener)', () => {
  it('uses window.alert for single button', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    setAlertListener(null);

    const mockAlert = jest.fn();
    global.window = { ...global.window, alert: mockAlert } as any;

    const onPress = jest.fn();
    showAlert('提示', '操作成功', [{ text: '确定', onPress }]);

    expect(mockAlert).toHaveBeenCalledWith('提示\n\n操作成功');
    expect(onPress).toHaveBeenCalled();
  });

  it('uses window.alert without message', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    setAlertListener(null);

    const mockAlert = jest.fn();
    global.window = { ...global.window, alert: mockAlert } as any;

    showAlert('只有标题');
    expect(mockAlert).toHaveBeenCalledWith('只有标题');
  });

  it('uses window.confirm for two buttons — confirmed', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    setAlertListener(null);

    const mockConfirm = jest.fn().mockReturnValue(true);
    global.window = { ...global.window, confirm: mockConfirm } as any;

    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    showAlert('确认', '是否继续？', [
      { text: '取消', onPress: onCancel },
      { text: '确定', onPress: onConfirm },
    ]);

    expect(mockConfirm).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses window.confirm for two buttons — cancelled', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    setAlertListener(null);

    const mockConfirm = jest.fn().mockReturnValue(false);
    global.window = { ...global.window, confirm: mockConfirm } as any;

    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    showAlert('确认', '是否继续？', [
      { text: '取消', onPress: onCancel },
      { text: '确定', onPress: onConfirm },
    ]);

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses window.prompt for 3+ buttons', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    setAlertListener(null);

    const mockPrompt = jest.fn().mockReturnValue('2');
    global.window = { ...global.window, prompt: mockPrompt } as any;

    const on1 = jest.fn();
    const on2 = jest.fn();
    const on3 = jest.fn();
    showAlert('选择', '请选择操作', [
      { text: '选项A', onPress: on1 },
      { text: '选项B', onPress: on2 },
      { text: '选项C', onPress: on3 },
    ]);

    expect(mockPrompt).toHaveBeenCalled();
    expect(on2).toHaveBeenCalled();
    expect(on1).not.toHaveBeenCalled();
    expect(on3).not.toHaveBeenCalled();
  });

  it('handles prompt cancellation (null result)', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    setAlertListener(null);

    const mockPrompt = jest.fn().mockReturnValue(null);
    global.window = { ...global.window, prompt: mockPrompt } as any;

    const onPress = jest.fn();
    showAlert('选择', '', [
      { text: 'A', onPress },
      { text: 'B', onPress },
      { text: 'C', onPress },
    ]);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('handles prompt with out-of-range index', () => {
    const { showAlert, setAlertListener } = require('@/utils/alert');
    setAlertListener(null);

    const mockPrompt = jest.fn().mockReturnValue('99');
    global.window = { ...global.window, prompt: mockPrompt } as any;

    const onPress = jest.fn();
    showAlert('选择', '', [
      { text: 'A', onPress },
      { text: 'B', onPress },
      { text: 'C', onPress },
    ]);

    // 99 is out of range for 3 buttons
    expect(onPress).not.toHaveBeenCalled();
  });
});
