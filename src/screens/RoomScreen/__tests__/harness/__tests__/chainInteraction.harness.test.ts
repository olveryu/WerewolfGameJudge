/**
 * Chain Interaction Harness Tests
 *
 * Proves the enhanced RoomScreenTestHarness can:
 * 1. Record dialog buttons with callbacks (per-event)
 * 2. Press buttons by label/index/type with fail-fast
 * 3. Chain: dialog → press → assert submit called / next dialog appeared
 *
 * These are unit tests for the harness itself (no React rendering).
 */

import {
  createShowAlertMock,
  RoomScreenTestHarness,
} from '@/screens/RoomScreen/__tests__/harness/RoomScreenTestHarness';

describe('RoomScreenTestHarness enhanced button API', () => {
  let harness: RoomScreenTestHarness;
  let mockShowAlert: jest.Mock;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    mockShowAlert = createShowAlertMock(harness);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Per-event callback storage
  // ─────────────────────────────────────────────────────────────────────────

  it('stores button callbacks per event (not just last dialog)', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    // Dialog 1
    mockShowAlert('狼人投票', '1号狼人 确定要猎杀3号玩家吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb1 },
    ]);

    // Dialog 2
    mockShowAlert('确认跳过', '确定不使用技能吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb2 },
    ]);

    // Press confirm on the wolfVote dialog (not the last one)
    harness.pressButtonOnType('wolfVote', '确定');
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    // Press confirm on the skipConfirm dialog (the last one)
    harness.pressButtonOnType('skipConfirm', '确定');
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressButton (by label, fail-fast)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressButton succeeds when button exists', () => {
    const cb = jest.fn();
    mockShowAlert('狼人投票', '确定要猎杀吗？', [{ text: '取消' }, { text: '确定', onPress: cb }]);

    harness.pressButton('确定');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('pressButton throws when no dialog recorded', () => {
    expect(() => harness.pressButton('确定')).toThrow(/No dialog recorded/);
  });

  it('pressButton throws when button label not found', () => {
    mockShowAlert('狼人投票', '确定要猎杀吗？', [{ text: '取消' }, { text: '确定' }]);

    expect(() => harness.pressButton('不存在的按钮')).toThrow(
      /Button "不存在的按钮" not found.*狼人投票/,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressButtonByIndex (fail-fast)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressButtonByIndex presses the correct button', () => {
    const confirmCb = jest.fn();
    const cancelCb = jest.fn();
    mockShowAlert('确认行动', '是否对3号使用技能？', [
      { text: '取消', onPress: cancelCb },
      { text: '确定', onPress: confirmCb },
    ]);

    harness.pressButtonByIndex(0); // "取消"
    expect(cancelCb).toHaveBeenCalledTimes(1);
    expect(confirmCb).not.toHaveBeenCalled();
  });

  it('pressButtonByIndex throws on out-of-range index', () => {
    mockShowAlert('提示', '消息', [{ text: '知道了' }]);
    expect(() => harness.pressButtonByIndex(5)).toThrow(/out of range/);
  });

  it('pressButtonByIndex throws when no dialog recorded', () => {
    expect(() => harness.pressButtonByIndex(0)).toThrow(/No dialog recorded/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressButtonOnType (by DialogType + label, fail-fast)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressButtonOnType finds the correct dialog type', () => {
    const wolfCb = jest.fn();
    const skipCb = jest.fn();

    mockShowAlert('狼人投票', '确定要猎杀5号吗？', [
      { text: '取消' },
      { text: '确定', onPress: wolfCb },
    ]);
    mockShowAlert('确认跳过', '确定不使用技能吗？', [
      { text: '取消' },
      { text: '确定', onPress: skipCb },
    ]);

    harness.pressButtonOnType('wolfVote', '确定');
    expect(wolfCb).toHaveBeenCalledTimes(1);
    expect(skipCb).not.toHaveBeenCalled();
  });

  it('pressButtonOnType throws when type not seen', () => {
    mockShowAlert('行动提示', '请预言家行动', [{ text: '知道了' }]);
    expect(() => harness.pressButtonOnType('wolfVote', '确定')).toThrow(
      /No dialog of type 'wolfVote' found/,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressPrimaryOnType (convenience)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressPrimaryOnType presses the primary (non-cancel) button of matching type', () => {
    const cb = jest.fn();
    mockShowAlert('狼人投票', '确定要猎杀5号吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb },
    ]);

    harness.pressPrimaryOnType('wolfVote');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressLastPrimary (convenience)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressLastPrimary presses the primary (non-cancel) button of the last dialog', () => {
    const cb = jest.fn();
    mockShowAlert('确认行动', '是否使用技能？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb },
    ]);

    harness.pressLastPrimary();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getLastEvent / getLastEventOfType
  // ─────────────────────────────────────────────────────────────────────────

  it('getLastEvent returns null when empty', () => {
    expect(harness.getLastEvent()).toBeNull();
  });

  it('getLastEvent returns the most recent event', () => {
    mockShowAlert('狼人投票', '消息1', [{ text: '确定' }]);
    mockShowAlert('确认跳过', '消息2', [{ text: '确定' }]);

    const last = harness.getLastEvent();
    expect(last).not.toBeNull();
    expect(last!.type).toBe('skipConfirm');
  });

  it('getLastEventOfType finds the last event of a specific type', () => {
    mockShowAlert('狼人投票', '第一次', [{ text: '确定' }]);
    mockShowAlert('确认跳过', '跳过', [{ text: '确定' }]);
    mockShowAlert('狼人投票', '第二次', [{ text: '确定' }]);

    const last = harness.getLastEventOfType('wolfVote');
    expect(last).not.toBeNull();
    expect(last!.message).toBe('第二次');
  });

  it('getLastEventOfType returns null when type not found', () => {
    mockShowAlert('确认跳过', '跳过', [{ text: '确定' }]);
    expect(harness.getLastEventOfType('wolfVote')).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Chain interaction: dialog → press → callback triggers next dialog
  // ─────────────────────────────────────────────────────────────────────────

  it('chain: press confirm on wolfVote → callback fires → next dialog appears', () => {
    const submitWolfVote = jest.fn();

    // Simulate: wolfVote dialog appears
    mockShowAlert('狼人投票', '1号狼人 确定要猎杀3号玩家吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => {
          submitWolfVote(2); // seat index 2 = player 3
        },
      },
    ]);

    // Test: press confirm
    harness.pressButtonOnType('wolfVote', '确定');

    // Assert: submitWolfVote was called with correct target
    expect(submitWolfVote).toHaveBeenCalledWith(2);
  });

  it('chain: witch save prompt → press 知道了 → next prompt appears', () => {
    let dismissed = false;

    // Simulate: witch save prompt (title contains '玩家死亡' → witchSavePrompt)
    mockShowAlert('女巫请行动', '3号被狼人杀了，是否使用解药？', [
      {
        text: '知道了',
        onPress: () => {
          dismissed = true;
          // After dismiss, a second dialog appears (action confirm)
          mockShowAlert('确认行动', '确定对5号使用技能吗？', [{ text: '取消' }, { text: '确定' }]);
        },
      },
    ]);

    expect(harness.events().length).toBe(1);
    expect(harness.hasSeen('witchSavePrompt')).toBe(true);

    // Press dismiss
    harness.pressLastPrimary();
    expect(dismissed).toBe(true);

    // Next dialog appeared (actionConfirm)
    expect(harness.events().length).toBe(2);
    expect(harness.hasSeen('actionConfirm')).toBe(true);
  });
});
