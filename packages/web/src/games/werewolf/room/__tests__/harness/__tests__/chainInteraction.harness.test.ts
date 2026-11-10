/**
 * Chain Interaction Harness Tests
 *
 * Proves the RoomScreenTestHarness can:
 * 1. Record every published alert with its buttons (per-event)
 * 2. Press buttons by label/index/type with fail-fast
 * 3. Chain: dialog → press → assert submit called / next dialog appeared
 *
 * These are unit tests for the harness itself (no React rendering); alerts go through the
 * real `showAlert` store.
 */

import {
  recordAlerts,
  RoomScreenTestHarness,
} from '@/games/werewolf/room/__tests__/harness/RoomScreenTestHarness';
import { alertStore, showAlert } from '@/utils/alert';

describe('RoomScreenTestHarness enhanced button API', () => {
  let harness: RoomScreenTestHarness;
  let detachAlerts: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  // ─────────────────────────────────────────────────────────────────────────
  // Per-event button storage
  // ─────────────────────────────────────────────────────────────────────────

  it('stores button callbacks per event (not just last dialog)', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    // Dialog 1
    showAlert('狼人投票', '1号狼人 确定袭击3号？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb1 },
    ]);

    // Dialog 2
    showAlert('跳过本次行动？', '确定不使用技能吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb2 },
    ]);

    // Press confirm on the wolfVote dialog (not the last one)
    await harness.pressButtonOnType('wolfVote', '确定');
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    // Press confirm on the skipConfirm dialog (the last one)
    await harness.pressButtonOnType('skipConfirm', '确定');
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressButton (by label, fail-fast)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressButton succeeds when button exists', async () => {
    const cb = vi.fn();
    showAlert('狼人投票', '确定袭击吗？', [{ text: '取消' }, { text: '确定', onPress: cb }]);

    await harness.pressButton('确定');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('pressButton throws when no dialog recorded', () => {
    expect(() => harness.pressButton('确定')).toThrow(/No dialog recorded/);
  });

  it('pressButton rejects when button label not found', async () => {
    showAlert('狼人投票', '确定袭击吗？', [{ text: '取消' }, { text: '确定' }]);

    await expect(harness.pressButton('不存在的按钮')).rejects.toThrow(
      /Button "不存在的按钮" not found.*狼人投票/,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressButtonByIndex (fail-fast)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressButtonByIndex presses the correct button', async () => {
    const confirmCb = vi.fn();
    const cancelCb = vi.fn();
    showAlert('确认行动', '是否对3号使用技能？', [
      { text: '取消', onPress: cancelCb },
      { text: '确定', onPress: confirmCb },
    ]);

    await harness.pressButtonByIndex(0); // "取消"
    expect(cancelCb).toHaveBeenCalledTimes(1);
    expect(confirmCb).not.toHaveBeenCalled();
  });

  it('pressButtonByIndex throws on out-of-range index', () => {
    showAlert('提示', '消息', [{ text: '知道了' }]);
    expect(() => harness.pressButtonByIndex(5)).toThrow(/out of range/);
  });

  it('pressButtonByIndex throws when no dialog recorded', () => {
    expect(() => harness.pressButtonByIndex(0)).toThrow(/No dialog recorded/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressButtonOnType (by DialogType + label, fail-fast)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressButtonOnType finds the correct dialog type', async () => {
    const wolfCb = vi.fn();
    const skipCb = vi.fn();

    showAlert('狼人投票', '确定袭击5号吗？', [{ text: '取消' }, { text: '确定', onPress: wolfCb }]);
    showAlert('跳过本次行动？', '确定不使用技能吗？', [
      { text: '取消' },
      { text: '确定', onPress: skipCb },
    ]);

    await harness.pressButtonOnType('wolfVote', '确定');
    expect(wolfCb).toHaveBeenCalledTimes(1);
    expect(skipCb).not.toHaveBeenCalled();
  });

  it('pressButtonOnType throws when type not seen', () => {
    showAlert('预言家行动', '请预言家行动', [{ text: '知道了' }]);
    expect(() => harness.pressButtonOnType('wolfVote', '确定')).toThrow(
      /No dialog of type 'wolfVote' found/,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressPrimaryOnType (convenience)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressPrimaryOnType presses the primary (non-cancel) button of matching type', async () => {
    const cb = vi.fn();
    showAlert('狼人投票', '确定袭击5号？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb },
    ]);

    await harness.pressPrimaryOnType('wolfVote');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pressLastPrimary (convenience)
  // ─────────────────────────────────────────────────────────────────────────

  it('pressLastPrimary presses the primary (non-cancel) button of the last dialog', async () => {
    const cb = vi.fn();
    showAlert('确认行动', '是否使用技能？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: cb },
    ]);

    await harness.pressLastPrimary();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AlertHost close protocol
  // ─────────────────────────────────────────────────────────────────────────

  it('closes the alert after a settled press and keeps it open after a rejected one', async () => {
    showAlert('确认行动', '是否使用技能？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => Promise.reject(new Error('transport')),
      },
    ]);

    await expect(harness.pressAndSettle('actionConfirm', '确定')).rejects.toThrow('transport');
    expect(alertStore.getSnapshot()?.title).toBe('确认行动');

    await harness.pressButtonOnType('actionConfirm', '取消');
    expect(alertStore.getSnapshot()).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getLastEvent / getLastEventOfType
  // ─────────────────────────────────────────────────────────────────────────

  it('getLastEvent returns null when empty', () => {
    expect(harness.getLastEvent()).toBeNull();
  });

  it('getLastEvent returns the most recent event', () => {
    showAlert('狼人投票', '消息1', [{ text: '确定' }]);
    showAlert('跳过本次行动？', '消息2', [{ text: '确定' }]);

    const last = harness.getLastEvent();
    expect(last).not.toBeNull();
    expect(last!.type).toBe('skipConfirm');
  });

  it('getLastEventOfType finds the last event of a specific type', () => {
    showAlert('狼人投票', '第一次', [{ text: '确定' }]);
    showAlert('跳过本次行动？', '跳过', [{ text: '确定' }]);
    showAlert('狼人投票', '第二次', [{ text: '确定' }]);

    const last = harness.getLastEventOfType('wolfVote');
    expect(last).not.toBeNull();
    expect(last!.message).toBe('第二次');
  });

  it('getLastEventOfType returns null when type not found', () => {
    showAlert('跳过本次行动？', '跳过', [{ text: '确定' }]);
    expect(harness.getLastEventOfType('wolfVote')).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Chain interaction: dialog → press → callback triggers next dialog
  // ─────────────────────────────────────────────────────────────────────────

  it('chain: press confirm on wolfVote → callback fires → next dialog appears', async () => {
    const submitAction = vi.fn();

    // Simulate: wolfVote dialog appears
    showAlert('狼人投票', '1号狼人 确定袭击3号？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => {
          submitAction({ kind: 'target', target: 2 });
        },
      },
    ]);

    await harness.pressButtonOnType('wolfVote', '确定');

    expect(submitAction).toHaveBeenCalledWith({ kind: 'target', target: 2 });
  });

  it('chain: witch save prompt → press 知道了 → next prompt appears', async () => {
    let dismissed = false;

    // Witch save prompt (title contains '女巫', message '被狼人袭击' → witchSavePrompt)
    showAlert('女巫请行动（可救人、用毒或跳过）', '3号被狼人袭击，是否使用解药？', [
      {
        text: '知道了',
        onPress: () => {
          dismissed = true;
          // After dismiss, a second dialog appears (action confirm)
          showAlert('确认行动', '确定对5号使用技能吗？', [{ text: '取消' }, { text: '确定' }]);
        },
      },
    ]);

    expect(harness.events().length).toBe(1);
    expect(harness.hasSeen('witchSavePrompt')).toBe(true);

    await harness.pressLastPrimary();
    expect(dismissed).toBe(true);

    // Next dialog appeared (actionConfirm) and stays open: the press closes only its own alert.
    expect(harness.events().length).toBe(2);
    expect(harness.hasSeen('actionConfirm')).toBe(true);
    expect(alertStore.getSnapshot()?.title).toBe('确认行动');
  });
});
