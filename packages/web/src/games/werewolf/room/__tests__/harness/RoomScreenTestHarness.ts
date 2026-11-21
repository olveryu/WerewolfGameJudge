/**
 * RoomScreenTestHarness — WerewolfRoomScreen UI test infrastructure.
 *
 * Responsibilities:
 * - Record every alert the room publishes to the alert store (`recordAlerts`)
 * - Provide fluent API for event inspection and assertions
 * - Single source of truth for dialog type classification (centralized classification)
 * - Press recorded buttons the way `AlertHost` does (await the callback, close on success,
 *   keep the alert open when the callback rejects)
 *
 * Not responsible for:
 * - Automatically clearing gates or skipping assertions
 * - Actual game logic execution
 *
 * Boundary constraints:
 * - Only for the Vitest environment; must not be referenced from production code
 */

import { SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { act } from '@testing-library/react';

import {
  type AlertButton,
  type AlertConfig,
  alertStore,
  dismissAlert,
  setAlertBlocked,
} from '@/utils/alert';

// =============================================================================
// Dialog Type Definitions (Single Source of Truth)
// =============================================================================

/**
 * All dialog types that can appear in WerewolfRoomScreen.
 * Classification is based on title/message patterns or caller context.
 */
export type DialogType =
  // Action flow dialogs
  | 'actionPrompt' // Generic "请XX行动" prompt
  | 'actionConfirm' // Seat selection confirmation
  | 'skipConfirm' // Skip action confirmation
  | 'actionRejected' // Host rejected action ("操作失败")

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
  | 'seedWolfInfectionResult' // Personal result in the final all-player acknowledgement

  // Role info dialogs
  | 'roleCard' // View role card

  // Seat dialogs (not from the night interaction, but still showAlert)
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
  /** Alert-store generation; pressing a button closes this alert only. */
  generation: number;
  /** Raw alert for debugging and style-aware button lookup. */
  raw: { title: string; message?: string; buttons: readonly AlertButton[] };
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
  { type: 'actionRejected', match: (t) => t === '操作失败' },

  // Wolf vote
  { type: 'wolfVoteEmpty', match: (t, m) => t === '狼人投票' && m.includes('放弃袭击') },
  { type: 'wolfVote', match: (t) => t === '狼人投票' },

  // Witch save flow
  { type: 'witchNoKill', match: (t) => t === '昨夜平安夜' },
  // Schema-driven: title is '女巫请行动', body contains promptTemplate or cannotSavePrompt text
  {
    type: 'witchSavePrompt',
    match: (t, m) => t.includes('女巫') && (m.includes('被狼人袭击') || m.includes('解药')),
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
    match: (t, m) =>
      !t.endsWith('行动') && (t.includes('预言家') || t.includes('查验结果')) && m.includes('酒鬼'),
  },
  {
    type: 'seerReveal',
    match: (t) => !t.endsWith('行动') && (t.includes('预言家') || t.includes('查验结果')),
  },
  {
    type: 'psychicReveal',
    match: (t) => !t.endsWith('行动') && (t.includes('通灵师') || t.includes('通灵结果')),
  },
  {
    type: 'gargoyleReveal',
    match: (t) => !t.endsWith('行动') && t.includes('石像鬼'),
  },
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
    match: (t) =>
      !t.endsWith('行动') &&
      (t.includes('机械狼人') || t.includes('你学习了') || t.includes('学习结果')),
  },

  // Magician
  { type: 'magicianFirst', match: (t) => t.includes('已选择第一位') },

  // Seed Wolf final infection result
  {
    type: 'seedWolfInfectionResult',
    match: (t, m) => {
      const infectionRevealUi = SCHEMAS.seedWolfInfectReveal.ui;
      return (
        t === '感染信息' &&
        (m === infectionRevealUi?.hypnotizedText || m === infectionRevealUi?.notHypnotizedText)
      );
    },
  },

  // Confirm trigger status dialogs: schema-driven confirmStatusUi.
  {
    type: 'confirmTrigger',
    match: (t, m) => {
      const hunterUi = SCHEMAS.hunterConfirm.ui?.confirmStatusUi;
      const darkUi = SCHEMAS.darkWolfKingConfirm.ui?.confirmStatusUi;
      const avengerUi = SCHEMAS.avengerConfirm.ui?.confirmStatusUi;
      const hiddenWolfUi = SCHEMAS.hiddenWolfReveal.ui?.confirmStatusUi;
      const seedWolfUi = SCHEMAS.seedWolfInfect.ui?.confirmStatusUi;

      const isHunterConfirm =
        hunterUi?.kind === 'shoot' &&
        t === hunterUi.statusDialogTitle &&
        (m === hunterUi.canText || m === hunterUi.cannotText);
      const isDarkWolfKingConfirm =
        darkUi?.kind === 'shoot' &&
        t === darkUi.statusDialogTitle &&
        (m === darkUi.canText || m === darkUi.cannotText);
      const isAvengerConfirm =
        avengerUi?.kind === 'faction' &&
        t === avengerUi.statusDialogTitle &&
        (m === avengerUi.goodText || m === avengerUi.wolfText || m === avengerUi.bondedText);
      const isHiddenWolfConfirm =
        hiddenWolfUi?.kind === 'wolfTeammates' && t === hiddenWolfUi.statusDialogTitle;
      const isSeedWolfConfirm =
        seedWolfUi?.kind === 'infection' && t === seedWolfUi.statusDialogTitle;

      return (
        isHunterConfirm ||
        isDarkWolfKingConfirm ||
        isAvengerConfirm ||
        isHiddenWolfConfirm ||
        isSeedWolfConfirm
      );
    },
  },

  // Role card
  { type: 'roleCard', match: (t) => t.includes('你的身份是') },

  // Seat errors
  { type: 'seatError', match: (t) => t === '入座失败' },
  { type: 'seatDisabled', match: (t) => t === '不可选择' },

  // Seed Wolf prompt includes “是否”, so classify its exact schema prompt before generic confirms.
  {
    type: 'actionPrompt',
    match: (t, m) => t.endsWith('行动') && m === SCHEMAS.seedWolfInfect.ui?.prompt,
  },

  // Skip confirmation
  { type: 'skipConfirm', match: (t) => t === '跳过本次行动？' },

  // Generic confirm (must be after specific confirms)
  {
    type: 'actionConfirm',
    match: (t, m) =>
      t.includes('确认') || t.includes('确定') || m.includes('是否') || m.includes('确定要'),
  },

  // Action prompt (generic "请XX行动" or role-specific prompts)
  {
    type: 'actionPrompt',
    match: (t, m) =>
      t.includes('请') ||
      t.includes('行动') ||
      m.includes('点击') ||
      m.includes('选择') ||
      t.includes('女巫') ||
      t.includes('守卫') ||
      t.includes('预言家') ||
      t.includes('猎人'),
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
  #events: DialogEvent[] = [];

  /** Get all recorded dialog events */
  events(): DialogEvent[] {
    return [...this.#events];
  }

  /** Get events of a specific type */
  eventsOfType(type: DialogType): DialogEvent[] {
    return this.#events.filter((e) => e.type === type);
  }

  /** Check if a dialog type has been seen */
  hasSeen(type: DialogType): boolean {
    return this.#events.some((e) => e.type === type);
  }

  /** Assert that a dialog type has been seen */
  expectSeen(type: DialogType): void {
    if (!this.hasSeen(type)) {
      const seenTypes = [...new Set(this.#events.map((e) => e.type))];
      const eventList = this.#events
        .map((e) => `  - ${e.type}: "${e.title}" :: ${JSON.stringify(e.message)}`)
        .join('\n');
      throw new Error(
        `Expected to see dialog type '${type}' but it was not seen.\n` +
          `Seen types: [${seenTypes.join(', ')}]\n` +
          `All events:\n${eventList}`,
      );
    }
  }

  /** Assert that a dialog type was seen exactly n times */
  expectCount(type: DialogType, n: number): void {
    const count = this.#events.filter((e) => e.type === type).length;
    if (count !== n) {
      throw new Error(
        `Expected dialog type '${type}' to appear ${n} times, but it appeared ${count} times`,
      );
    }
  }

  /** Assert coverage: all required types must have been seen */
  assertCoverage(requiredTypes: DialogType[]): void {
    const missing = requiredTypes.filter((type) => !this.hasSeen(type));
    if (missing.length > 0) {
      const seenTypes = [...new Set(this.#events.map((e) => e.type))];
      throw new Error(
        `Missing dialog coverage for: [${missing.join(', ')}]\n` +
          `Seen types: [${seenTypes.join(', ')}]`,
      );
    }
  }

  /** Assert no infinite loop: a dialog type should not appear more than maxTimesPerStep times */
  assertNoLoop(opts: { type: DialogType; maxTimesPerStep?: number }): void {
    const { type, maxTimesPerStep = 3 } = opts;
    const count = this.#events.filter((e) => e.type === type).length;
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

  /** The last recorded dialog event, or null when none was recorded. */
  getLastEvent(): DialogEvent | null {
    return this.#events.at(-1) ?? null;
  }

  /** The last recorded dialog event of a type, or null when none matches. */
  getLastEventOfType(type: DialogType): DialogEvent | null {
    for (let i = this.#events.length - 1; i >= 0; i--) {
      if (this.#events[i]!.type === type) return this.#events[i]!;
    }
    return null;
  }

  /** Press a button on the last dialog, identified by label. Throws when absent. */
  pressButton(label: string): Promise<void> {
    const last = this.#events.at(-1);
    if (!last) {
      throw new Error(`[pressButton] No dialog recorded. Cannot press "${label}".`);
    }
    return this.#pressButtonOnEvent(last, label);
  }

  /** Press a button by index on the last dialog. Throws on no dialog or out-of-range index. */
  pressButtonByIndex(index: number): Promise<void> {
    const last = this.#events.at(-1);
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
    return this.#pressButtonOnEvent(last, last.buttons[index]!);
  }

  /** Press a button on the last dialog of a type, identified by label. Throws when absent. */
  pressButtonOnType(type: DialogType, label: string): Promise<void> {
    return this.#pressButtonOnEvent(this.#requireEventOfType('pressButtonOnType', type), label);
  }

  /** Press the primary (non-cancel) button on the last dialog. */
  pressLastPrimary(): Promise<void> {
    const event = this.getLastEvent();
    if (!event) {
      throw new Error('[pressLastPrimary] No dialog recorded.');
    }
    return this.#pressButtonOnEvent(event, this.#findPrimaryButton(event));
  }

  /** Press the primary (non-cancel) button on the last dialog of a type. */
  pressPrimaryOnType(type: DialogType): Promise<void> {
    const event = this.#requireEventOfType('pressPrimaryOnType', type);
    return this.#pressButtonOnEvent(event, this.#findPrimaryButton(event));
  }

  /**
   * Press a button on the last dialog of a type and settle its callback, for asserting the
   * AlertHost retry protocol (a rejecting callback keeps the dialog open). `label` defaults to
   * the primary button.
   */
  pressAndSettle(type: DialogType, label?: string): Promise<void> {
    const event = this.#requireEventOfType('pressAndSettle', type);
    return this.#pressButtonOnEvent(event, label ?? this.#findPrimaryButton(event));
  }

  #requireEventOfType(caller: string, type: DialogType): DialogEvent {
    const event = this.getLastEventOfType(type);
    if (!event) {
      const seenTypes = [...new Set(this.#events.map((e) => e.type))];
      throw new Error(
        `[${caller}] No dialog of type '${type}' found.\n` +
          `Seen types: [${seenTypes.join(', ')}]\n` +
          `Total events: ${this.#events.length}`,
      );
    }
    return event;
  }

  /** The primary (non-cancel) button label; the first button when no style tells them apart. */
  #findPrimaryButton(event: DialogEvent): string {
    if (event.buttons.length === 0) {
      throw new Error(`[pressPrimary] Dialog ("${event.title}") has no buttons.`);
    }
    if (event.raw.buttons.length > 1) {
      const primary = event.raw.buttons.find((b) => b.style !== 'cancel');
      if (primary?.text) return primary.text;
    }
    return event.buttons[0]!;
  }

  /** Mirrors `AlertHost`: await the callback, then close the alert unless it rejected. */
  async #pressButtonOnEvent(event: DialogEvent, label: string): Promise<void> {
    const button = event.raw.buttons.find((candidate) => candidate.text === label);
    if (button === undefined) {
      throw new Error(
        `[pressButton] Button "${label}" not found in dialog "${event.title}".\n` +
          `Available buttons: [${event.buttons.join(', ')}]\n` +
          `Message: "${event.message}"`,
      );
    }
    await act(async () => {
      await button.onPress?.();
    });
    dismissAlert(event.generation);
  }

  /** Clear all recorded events */
  clear(): void {
    this.#events = [];
  }

  /** @internal Called by `recordAlerts` for every newly published alert. */
  record(alert: AlertConfig): void {
    const message = alert.message ?? '';
    this.#events.push({
      type: classifyDialog(alert.title, message),
      title: alert.title,
      message,
      buttons: alert.buttons.map((b) => b.text),
      generation: alert.generation,
      raw: { title: alert.title, message: alert.message, buttons: alert.buttons },
    });
  }
}

// =============================================================================
// Alert store subscription
// =============================================================================

/**
 * Records every alert published through `showAlert` / `showPrompt` into the harness. Returns the
 * detach function, which also closes any alert left open and lifts an alert block so the next
 * test starts from an empty store.
 */
export function recordAlerts(harness: RoomScreenTestHarness): () => void {
  let lastGeneration = alertStore.getSnapshot()?.generation ?? null;
  const unsubscribe = alertStore.subscribe(() => {
    const alert = alertStore.getSnapshot();
    if (alert === null || alert.generation === lastGeneration) return;
    lastGeneration = alert.generation;
    harness.record(alert);
  });
  return () => {
    unsubscribe();
    setAlertBlocked(false);
    const open = alertStore.getSnapshot();
    if (open !== null) dismissAlert(open.generation);
  };
}
