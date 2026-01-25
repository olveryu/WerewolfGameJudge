/**
 * RoomScreenTestHarness
 *
 * Test infrastructure for RoomScreen UI tests.
 * Intercepts and records all showAlert calls, providing assertion APIs.
 *
 * Design:
 * - Dialog type classification is centralized here (single source of truth)
 * - Provides fluent API for event inspection and assertions
 * - Supports loop detection and coverage verification
 */

import { showAlert as realShowAlert } from '../../../../utils/alert';

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
  | 'witchSaveConfirm' // Witch save confirmation
  | 'witchCannotSave' // Witch cannot save (self killed)
  | 'witchNoKill' // No one killed last night
  | 'witchPoisonPrompt' // Witch poison prompt
  | 'witchPoisonConfirm' // Witch poison confirmation

  // Reveal dialogs
  | 'seerReveal' // Seer reveal result
  | 'psychicReveal' // Psychic reveal result
  | 'gargoyleReveal' // Gargoyle reveal result
  | 'wolfRobotReveal' // WolfRobot learn result
  | 'wolfRobotHunterStatus' // WolfRobot learned hunter status

  // Special dialogs
  | 'blocked' // Nightmare blocked alert
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

  // Blocked
  { type: 'blocked', match: (t) => t === '你已被封锁' || t.includes('被封锁') },

  // Wolf vote
  { type: 'wolfVoteEmpty', match: (t, m) => t === '狼人投票' && m.includes('空刀') },
  { type: 'wolfVote', match: (t) => t === '狼人投票' },

  // Witch save flow
  { type: 'witchNoKill', match: (t) => t === '昨夜无人倒台' },
  { type: 'witchCannotSave', match: (t, m) => t.includes('倒台玩家') && m.includes('无法自救') },
  { type: 'witchSaveConfirm', match: (t, m) => t.includes('倒台玩家') && m.includes('是否救助') },
  { type: 'witchSavePrompt', match: (t) => t.includes('倒台玩家') || t.includes('玩家死亡') },

  // Witch poison flow
  { type: 'witchPoisonConfirm', match: (t) => t.includes('毒杀') && t.includes('号') },
  { type: 'witchPoisonPrompt', match: (t, m) => t.includes('毒药') || m.includes('毒药') },

  // Reveals (based on title patterns)
  { type: 'seerReveal', match: (t) => t.includes('预言家') || t.includes('查验结果') },
  { type: 'psychicReveal', match: (t) => t.includes('通灵师') },
  { type: 'gargoyleReveal', match: (t) => t.includes('石像鬼') },
  // wolfRobotHunterStatus: uses message because title is generic '技能状态'
  { type: 'wolfRobotHunterStatus', match: (t, m) => m.includes('机械狼') && m.includes('猎人') },
  { type: 'wolfRobotReveal', match: (t) => t.includes('机械狼') || t.includes('你学习了') },

  // Magician
  { type: 'magicianFirst', match: (t) => t.includes('已选择第一位') },

  // Confirm trigger (hunter/darkWolfKing status)
  { type: 'confirmTrigger', match: (t) => t.includes('发动状态') || t.includes('确认发动') || t.includes('技能状态') },

  // Role card
  { type: 'roleCard', match: (t) => t.includes('你的身份是') },

  // Seat errors
  { type: 'seatError', match: (t) => t === '入座失败' },
  { type: 'seatDisabled', match: (t) => t === '不可选择' },

  // Skip confirmation
  { type: 'skipConfirm', match: (t) => t === '确认跳过' || t.includes('不使用技能') },

  // Generic confirm (must be after specific confirms)
  {
    type: 'actionConfirm',
    match: (t, m) => {
      // Has 确定/取消 buttons implied by confirm dialogs
      return (
        t.includes('确认') ||
        t.includes('确定') ||
        m.includes('是否') ||
        m.includes('确定要')
      );
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
  private readonly _buttonCallbacks: Map<string, (() => void) | undefined> = new Map();

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
      const eventList = this._events.map((e) => `  - ${e.type}: "${e.title}"`).join('\n');
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

  /**
   * Press a button by text (triggers the callback if any)
   */
  press(text: string): void {
    const callback = this._buttonCallbacks.get(text);
    if (callback) {
      callback();
    }
  }

  /**
   * Press the primary button (first button, usually "确定" or "知道了")
   */
  pressPrimary(): void {
    const lastEvent = this._events.at(-1);
    if (lastEvent && lastEvent.buttons.length > 0) {
      this.press(lastEvent.buttons[0]);
    }
  }

  /**
   * Press the cancel button (second button, usually "取消")
   */
  pressCancel(): void {
    const lastEvent = this._events.at(-1);
    if (lastEvent && lastEvent.buttons.length > 1) {
      this.press(lastEvent.buttons[1]);
    }
  }

  /**
   * Clear all recorded events
   */
  clear(): void {
    this._events = [];
    this._buttonCallbacks.clear();
  }

  /**
   * Get the last event
   */
  lastEvent(): DialogEvent | undefined {
    return this._events.at(-1);
  }

  /**
   * Record a showAlert call
   * @internal Called by the mock
   */
  _record(title: string, message?: string, buttons?: any[]): void {
    const msg = message || '';
    const type = classifyDialog(title, msg);
    const buttonTexts = (buttons || [{ text: '确定' }]).map((b: any) => b.text || '');

    // Store callbacks for press simulation
    this._buttonCallbacks.clear();
    for (const btn of buttons || []) {
      if (btn.text && btn.onPress) {
        this._buttonCallbacks.set(btn.text, btn.onPress);
      }
    }

    this._events.push({
      type,
      title,
      message: msg,
      buttons: buttonTexts,
      timestamp: Date.now(),
      raw: { title, message, buttons },
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
export function setupHarness(): RoomScreenTestHarness {
  const harness = new RoomScreenTestHarness();
  const mockShowAlert = createShowAlertMock(harness);

  // Replace the mock implementation
  (realShowAlert as jest.Mock).mockImplementation(mockShowAlert);

  return harness;
}
