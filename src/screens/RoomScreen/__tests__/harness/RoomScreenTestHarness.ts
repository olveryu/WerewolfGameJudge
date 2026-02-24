/**
 * RoomScreenTestHarness - RoomScreen UI 测试基础设施
 *
 * 职责：
 * - 拦截并记录所有 showAlert 调用
 * - 提供 fluent API 用于事件检查和断言
 * - Dialog 类型分类的单一真相（centralized classification）
 * - 支持循环检测和覆盖率验证
 *
 * 提供拦截 dialog、断言、覆盖率检查能力，不自动清除 gate 或跳过断言。
 */

import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';

import { showAlert as realShowAlert } from '@/utils/alert';

// =============================================================================
// Dialog Type Definitions (Single Source of Truth)
// =============================================================================

/**
 * All dialog types that can appear in RoomScreen.
 * Classification is based on title/message patterns or caller context.
 */
export type DialogType =
  // Action flow dialogs
  | 'actionPrompt' // Generic "请XX行动" prompt
  | 'actionConfirm' // Seat selection confirmation
  | 'skipConfirm' // Skip action confirmation
  | 'actionRejected' // Host rejected action ("操作无效")

  // Wolf dialogs
  | 'wolfVote' // Wolf vote confirmation
  | 'wolfVoteEmpty' // Wolf empty knife confirmation

  // Witch dialogs
  | 'witchSavePrompt' // Witch save prompt (昨夜X号死亡)
  | 'witchNoKill' // No one killed last night
  | 'witchPoisonPrompt' // Witch poison prompt

  // Reveal dialogs
  | 'seerReveal' // Seer reveal result
  | 'psychicReveal' // Psychic reveal result
  | 'gargoyleReveal' // Gargoyle reveal result
  | 'wolfRobotReveal' // WolfRobot learn result
  | 'wolfRobotHunterStatus' // WolfRobot learned hunter status
  | 'mirrorSeerReveal' // MirrorSeer reveal result (inverted)
  | 'drunkSeerReveal' // DrunkSeer reveal result (random)
  | 'pureWhiteReveal' // PureWhite reveal result
  | 'wolfWitchReveal' // WolfWitch reveal result

  // Special dialogs
  | 'magicianFirst' // Magician first target selected
  | 'confirmTrigger' // Hunter/DarkWolfKing confirm trigger

  // Role info dialogs
  | 'roleCard' // View role card

  // Seat dialogs (not from useRoomActionDialogs, but still showAlert)
  | 'seatError' // Seat taken error
  | 'seatDisabled' // Cannot select seat

  // Unknown (fallback)
  | 'unknown';

// =============================================================================
// Dialog Event Record
// =============================================================================

export interface DialogEvent {
  type: DialogType;
  title: string;
  message: string;
  buttons: string[];
  timestamp: number;
  /** Raw call arguments for debugging */
  raw: { title: string; message?: string; buttons?: any[] };
  /**
   * Button callbacks keyed by button text.
   * Use harness.pressButton() to invoke; do NOT call directly.
   * @internal
   */
  _callbacks: Map<string, (() => void) | undefined>;
}

// =============================================================================
// Dialog Type Classification (Pattern-based)
// =============================================================================

interface ClassificationRule {
  type: DialogType;
  match: (title: string, message: string) => boolean;
}

/**
 * Classification rules in priority order.
 * First match wins.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Action rejected
  { type: 'actionRejected', match: (t) => t === '操作无效' },

  // Wolf vote
  { type: 'wolfVoteEmpty', match: (t, m) => t === '狼人投票' && m.includes('空刀') },
  { type: 'wolfVote', match: (t) => t === '狼人投票' },

  // Witch save flow
  { type: 'witchNoKill', match: (t) => t === '昨夜无人倒台' },
  // Schema-driven: title is '女巫请行动', body contains promptTemplate or cannotSavePrompt text
  {
    type: 'witchSavePrompt',
    match: (t, m) => t.includes('女巫') && (m.includes('被狼人杀了') || m.includes('解药')),
  },

  // Witch poison flow
  { type: 'witchPoisonPrompt', match: (t, m) => t.includes('毒药') || m.includes('毒药') },

  // Reveals (based on title patterns)
  {
    type: 'mirrorSeerReveal',
    match: (t, m) => (t.includes('预言家') || t.includes('查验结果')) && m.includes('灯影'),
  },
  {
    type: 'drunkSeerReveal',
    match: (t, m) => (t.includes('预言家') || t.includes('查验结果')) && m.includes('酒鬼'),
  },
  { type: 'seerReveal', match: (t) => t.includes('预言家') || t.includes('查验结果') },
  { type: 'psychicReveal', match: (t) => t.includes('通灵师') || t.includes('通灵结果') },
  { type: 'gargoyleReveal', match: (t) => t.includes('石像鬼') },
  // wolfRobotHunterStatus: schema-driven title/message for wolfRobotLearn hunter gate.
  {
    type: 'wolfRobotHunterStatus',
    match: (t, m) => {
      const title = SCHEMAS.wolfRobotLearn.ui?.hunterGateDialogTitle;
      const canShootText = SCHEMAS.wolfRobotLearn.ui?.hunterGateCanShootText;
      const cannotShootText = SCHEMAS.wolfRobotLearn.ui?.hunterGateCannotShootText;
      if (!title || !canShootText || !cannotShootText) return false;
      return t === title && (m === canShootText || m === cannotShootText);
    },
  },
  {
    type: 'wolfRobotReveal',
    match: (t) => t.includes('机械狼') || t.includes('你学习了') || t.includes('学习结果'),
  },

  // Magician
  { type: 'magicianFirst', match: (t) => t.includes('已选择第一位') },

  // Confirm trigger (hunter/darkWolfKing status): schema-driven title/message.
  {
    type: 'confirmTrigger',
    match: (t, m) => {
      const hunterTitle = SCHEMAS.hunterConfirm.ui?.statusDialogTitle;
      const hunterCan = SCHEMAS.hunterConfirm.ui?.canShootText;
      const hunterCannot = SCHEMAS.hunterConfirm.ui?.cannotShootText;

      const darkTitle = SCHEMAS.darkWolfKingConfirm.ui?.statusDialogTitle;
      const darkCan = SCHEMAS.darkWolfKingConfirm.ui?.canShootText;
      const darkCannot = SCHEMAS.darkWolfKingConfirm.ui?.cannotShootText;

      const isHunterConfirm =
        !!hunterTitle &&
        !!hunterCan &&
        !!hunterCannot &&
        t === hunterTitle &&
        (m === hunterCan || m === hunterCannot);
      const isDarkWolfKingConfirm =
        !!darkTitle &&
        !!darkCan &&
        !!darkCannot &&
        t === darkTitle &&
        (m === darkCan || m === darkCannot);

      return isHunterConfirm || isDarkWolfKingConfirm;
    },
  },

  // Role card
  { type: 'roleCard', match: (t) => t.includes('你的身份是') },

  // Seat errors
  { type: 'seatError', match: (t) => t === '入座失败' },
  { type: 'seatDisabled', match: (t) => t === '不可选择' },

  // Skip confirmation
  { type: 'skipConfirm', match: (t) => t === '确认跳过' },

  // Generic confirm (must be after specific confirms)
  {
    type: 'actionConfirm',
    match: (t, m) => {
      // Has 确定/取消 buttons implied by confirm dialogs
      return t.includes('确认') || t.includes('确定') || m.includes('是否') || m.includes('确定要');
    },
  },

  // Action prompt (generic "请XX行动" or role-specific prompts)
  {
    type: 'actionPrompt',
    match: (t, m) => {
      return (
        t.includes('请') ||
        t.includes('行动') ||
        m.includes('点击') ||
        m.includes('选择') ||
        t.includes('女巫') ||
        t.includes('守卫') ||
        t.includes('预言家') ||
        t.includes('猎人')
      );
    },
  },
];

function classifyDialog(title: string, message: string): DialogType {
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.match(title, message)) {
      return rule.type;
    }
  }
  return 'unknown';
}

// =============================================================================
// Harness Implementation
// =============================================================================

export class RoomScreenTestHarness {
  private _events: DialogEvent[] = [];

  /**
   * Get all recorded dialog events
   */
  events(): DialogEvent[] {
    return [...this._events];
  }

  /**
   * Get events of a specific type
   */
  eventsOfType(type: DialogType): DialogEvent[] {
    return this._events.filter((e) => e.type === type);
  }

  /**
   * Check if a dialog type has been seen
   */
  hasSeen(type: DialogType): boolean {
    return this._events.some((e) => e.type === type);
  }

  /**
   * Assert that a dialog type has been seen
   */
  expectSeen(type: DialogType): void {
    if (!this.hasSeen(type)) {
      const seenTypes = [...new Set(this._events.map((e) => e.type))];
      const eventList = this._events
        .map((e) => `  - ${e.type}: "${e.title}" :: ${JSON.stringify(e.message)}`)
        .join('\n');
      throw new Error(
        `Expected to see dialog type '${type}' but it was not seen.\n` +
          `Seen types: [${seenTypes.join(', ')}]\n` +
          `All events:\n${eventList}`,
      );
    }
  }

  /**
   * Assert that a dialog type was seen exactly n times
   */
  expectCount(type: DialogType, n: number): void {
    const count = this._events.filter((e) => e.type === type).length;
    if (count !== n) {
      throw new Error(
        `Expected dialog type '${type}' to appear ${n} times, but it appeared ${count} times`,
      );
    }
  }

  /**
   * Assert coverage: all required types must have been seen
   */
  assertCoverage(requiredTypes: DialogType[]): void {
    const missing: DialogType[] = [];
    for (const type of requiredTypes) {
      if (!this.hasSeen(type)) {
        missing.push(type);
      }
    }
    if (missing.length > 0) {
      const seenTypes = [...new Set(this._events.map((e) => e.type))];
      throw new Error(
        `Missing dialog coverage for: [${missing.join(', ')}]\n` +
          `Seen types: [${seenTypes.join(', ')}]`,
      );
    }
  }

  /**
   * Assert no infinite loop: a dialog type should not appear more than maxTimesPerStep times
   */
  assertNoLoop(opts: { type: DialogType; maxTimesPerStep?: number }): void {
    const { type, maxTimesPerStep = 3 } = opts;
    const count = this._events.filter((e) => e.type === type).length;
    if (count > maxTimesPerStep) {
      throw new Error(
        `Potential infinite loop detected: dialog type '${type}' appeared ${count} times ` +
          `(max allowed: ${maxTimesPerStep})`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Button Press API (fail-fast)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the last recorded dialog event.
   * Returns null if no dialogs have been recorded.
   */
  getLastEvent(): DialogEvent | null {
    return this._events.at(-1) ?? null;
  }

  /**
   * Get the last recorded dialog event of a specific type.
   * Returns null if no matching dialog has been recorded.
   */
  getLastEventOfType(type: DialogType): DialogEvent | null {
    for (let i = this._events.length - 1; i >= 0; i--) {
      if (this._events[i].type === type) return this._events[i];
    }
    return null;
  }

  /**
   * Press a button on the last dialog, identified by label.
   * FAIL-FAST: Throws if no dialog recorded or button label not found.
   *
   * @example
   * harness.pressButton('确定');
   * harness.pressButton('取消');
   */
  pressButton(label: string): void {
    const last = this._events.at(-1);
    if (!last) {
      throw new Error(`[pressButton] No dialog recorded. Cannot press "${label}".`);
    }
    this._pressButtonOnEvent(last, label);
  }

  /**
   * Press a button by index on the last dialog.
   * FAIL-FAST: Throws if no dialog or index out of range.
   *
   * @example
   * harness.pressButtonByIndex(0); // first button (usually "确定")
   * harness.pressButtonByIndex(1); // second button (usually "取消")
   */
  pressButtonByIndex(index: number): void {
    const last = this._events.at(-1);
    if (!last) {
      throw new Error(
        `[pressButtonByIndex] No dialog recorded. Cannot press button at index ${index}.`,
      );
    }
    if (index < 0 || index >= last.buttons.length) {
      throw new Error(
        `[pressButtonByIndex] Button index ${index} out of range. ` +
          `Last dialog "${last.title}" has ${last.buttons.length} button(s): [${last.buttons.join(', ')}]`,
      );
    }
    this._pressButtonOnEvent(last, last.buttons[index]);
  }

  /**
   * Press a button on the last dialog of a given type, identified by label.
   * FAIL-FAST: Throws if no dialog of that type found or button label not found.
   *
   * @example
   * harness.pressButtonOnType('wolfVote', '确定');
   * harness.pressButtonOnType('skipConfirm', '确定');
   */
  pressButtonOnType(type: DialogType, label: string): void {
    const event = this.getLastEventOfType(type);
    if (!event) {
      const seenTypes = [...new Set(this._events.map((e) => e.type))];
      throw new Error(
        `[pressButtonOnType] No dialog of type '${type}' found.\n` +
          `Seen types: [${seenTypes.join(', ')}]\n` +
          `Total events: ${this._events.length}`,
      );
    }
    this._pressButtonOnEvent(event, label);
  }

  /**
   * Press the primary (non-cancel) button on the last dialog.
   * FAIL-FAST: Throws if no dialog recorded or no buttons.
   */
  pressLastPrimary(): void {
    const event = this.getLastEvent();
    if (!event) {
      throw new Error('[pressLastPrimary] No dialog recorded.');
    }
    if (event.buttons.length === 0) {
      throw new Error(`[pressLastPrimary] Dialog ("${event.title}") has no buttons.`);
    }
    const primaryLabel = this._findPrimaryButton(event);
    this._pressButtonOnEvent(event, primaryLabel);
  }

  /**
   * Press the primary (first) button on the last dialog of a given type.
   * FAIL-FAST: Throws if no dialog of that type found or no buttons.
   */
  pressPrimaryOnType(type: DialogType): void {
    const event = this.getLastEventOfType(type);
    if (!event) {
      const seenTypes = [...new Set(this._events.map((e) => e.type))];
      throw new Error(
        `[pressPrimaryOnType] No dialog of type '${type}' found.\n` +
          `Seen types: [${seenTypes.join(', ')}]\n` +
          `Total events: ${this._events.length}`,
      );
    }
    if (event.buttons.length === 0) {
      throw new Error(`[pressPrimaryOnType] Dialog '${type}' ("${event.title}") has no buttons.`);
    }
    const primaryLabel = this._findPrimaryButton(event);
    this._pressButtonOnEvent(event, primaryLabel);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: find primary/cancel button by style (position-independent)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find the primary (non-cancel) button label from raw button data.
   * Falls back to first button if no style info available.
   */
  private _findPrimaryButton(event: DialogEvent): string {
    const rawButtons = event.raw.buttons;
    if (rawButtons && rawButtons.length > 1) {
      const primary = rawButtons.find((b: any) => b.style !== 'cancel');
      if (primary?.text) return primary.text;
    }
    return event.buttons[0];
  }

  /**
   * Find the cancel button label from raw button data.
   * Falls back to second button if no style info available.
   */
  private _findCancelButton(event: DialogEvent): string | null {
    const rawButtons = event.raw.buttons;
    if (rawButtons && rawButtons.length > 1) {
      const cancel = rawButtons.find((b: any) => b.style === 'cancel');
      if (cancel?.text) return cancel.text;
    }
    return event.buttons.length > 1 ? event.buttons[1] : null;
  }

  /**
   * Internal: press a button on a specific event, with fail-fast.
   */
  private _pressButtonOnEvent(event: DialogEvent, label: string): void {
    const callback = event._callbacks.get(label);
    if (callback === undefined && !event._callbacks.has(label)) {
      throw new Error(
        `[pressButton] Button "${label}" not found in dialog "${event.title}".\n` +
          `Available buttons: [${event.buttons.join(', ')}]\n` +
          `Message: "${event.message}"`,
      );
    }
    // callback may be undefined (button exists but no onPress) — that's valid, just a no-op
    callback?.();
  }

  /**
   * Clear all recorded events
   */
  clear(): void {
    this._events = [];
  }

  /**
   * Record a showAlert call
   * @internal Called by the mock
   */
  _record(title: string, message?: string, buttons?: any[]): void {
    const msg = message || '';
    const type = classifyDialog(title, msg);
    const btnArray = buttons || [{ text: '确定' }];
    const buttonTexts = btnArray.map((b: any) => b.text || '');

    // Build per-event callback map
    const callbacks = new Map<string, (() => void) | undefined>();
    for (const btn of btnArray) {
      if (btn.text) {
        callbacks.set(btn.text, btn.onPress);
      }
    }

    this._events.push({
      type,
      title,
      message: msg,
      buttons: buttonTexts,
      timestamp: Date.now(),
      raw: { title, message, buttons },
      _callbacks: callbacks,
    });
  }
}

// =============================================================================
// Mock Factory
// =============================================================================

/**
 * Create a mock for showAlert that records to the harness
 */
export function createShowAlertMock(harness: RoomScreenTestHarness) {
  return jest.fn((title: string, message?: string, buttons?: any[]) => {
    harness._record(title, message, buttons);
  });
}

/**
 * Setup the harness by mocking showAlert.
 * Returns the harness instance.
 *
 * Usage:
 * ```ts
 * const harness = setupHarness();
 * // ... render and interact ...
 * harness.expectSeen('wolfVote');
 * ```
 */
function _setupHarness(): RoomScreenTestHarness {
  const harness = new RoomScreenTestHarness();
  const mockShowAlert = createShowAlertMock(harness);

  // Replace the mock implementation
  (realShowAlert as jest.Mock).mockImplementation(mockShowAlert);

  return harness;
}
