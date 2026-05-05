/**
 * bottomLayoutConfig — Declarative bottom panel layout system.
 *
 * Defines the three-tier button layout model (primary / secondary / ghost),
 * a static button registry, and the LAYOUT_RULES table that maps
 * (GameStatus × user role × conditions) → button layout.
 *
 * Pure data — no React, no hooks, no side effects.
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import type { ActionIntent } from '@/screens/RoomScreen/policy/types';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

/** Fully resolved button ready for rendering. */
export interface ButtonConfig {
  key: string;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'lg' | 'md';
  /** Schema-driven action intent (for BOTTOM_ACTION dispatch). */
  intent?: ActionIntent;
  /** Static button identifier (for HOST_CONTROL / VIEW_ROLE dispatch). */
  action?: StaticButtonId;
  testID?: string;
  disabled?: boolean;
  fireWhenDisabled?: boolean;
  /** Text color override (e.g. danger-colored ghost button). */
  textColor?: string;
  /** Background color override (e.g. info-colored settings button). */
  buttonColor?: string;
}

/** The three-tier layout produced by resolveBottomLayout. */
export interface BottomLayout {
  primary: readonly ButtonConfig[];
  secondary: readonly ButtonConfig[];
  ghost: readonly ButtonConfig[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Static button IDs
// ─────────────────────────────────────────────────────────────────────────────

export type StaticButtonId =
  | 'viewRole'
  | 'waitForHost'
  | 'audioWaiting'
  | 'settings'
  | 'prepareToFlip'
  | 'startGame'
  | 'restart'
  | 'lastNightInfo'
  | 'nightReview';

// ─────────────────────────────────────────────────────────────────────────────
// Static button definitions
// ─────────────────────────────────────────────────────────────────────────────

interface StaticButtonDef {
  label: string;
  testID?: string;
  /** When rendered as ghost, override text color (e.g. danger). */
  ghostTextColor?: string;
  /** When rendered as primary, override button background color. */
  primaryButtonColor?: string;
}

export const STATIC_BUTTONS: Record<StaticButtonId, StaticButtonDef> = {
  viewRole: {
    label: '查看身份',
  },
  waitForHost: {
    label: '等待房主开始',
  },
  audioWaiting: {
    label: '语音播报中…',
    testID: TESTIDS.audioWaitingButton,
  },
  settings: {
    label: '房间配置',
    testID: TESTIDS.roomSettingsButton,
    primaryButtonColor: colors.info,
  },
  prepareToFlip: {
    label: '分配角色',
    testID: TESTIDS.prepareToFlipButton,
  },
  startGame: {
    label: '开始游戏',
    testID: TESTIDS.startGameButton,
  },
  restart: {
    label: '重新开始',
    testID: TESTIDS.restartButton,
    ghostTextColor: colors.error,
  },
  lastNightInfo: {
    label: '昨夜信息',
    testID: TESTIDS.lastNightInfoButton,
  },
  nightReview: {
    label: '详细信息',
    testID: TESTIDS.nightReviewButton,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Rule types
// ─────────────────────────────────────────────────────────────────────────────

/** Context passed to rule matchers and condition functions. */
export interface LayoutContext {
  roomStatus: GameStatus;
  isHost: boolean;
  effectiveSeat: number | null;
  imActioner: boolean;
  isAudioPlaying: boolean;
  isStartingGame: boolean;
  isHostActionSubmitting: boolean;
  nightReviewAllowedSeats: readonly number[];
}

/** What to put in a button slot. */
export type ButtonSlot =
  | { readonly source: 'schema'; readonly tier: 'primary' | 'secondary' }
  | { readonly source: 'static'; readonly button: StaticButtonId };

type UserRole = 'host' | 'player' | 'spectator';

/** A single layout rule: condition → three-tier button placement. */
interface LayoutRule {
  readonly match: {
    readonly status: GameStatus | readonly GameStatus[];
    readonly role: UserRole;
    readonly when?: (ctx: LayoutContext) => boolean;
  };
  readonly layout: {
    readonly primary: readonly ButtonSlot[];
    readonly secondary: readonly ButtonSlot[];
    readonly ghost: readonly ButtonSlot[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout rules table
//
// Rules are matched top-to-bottom; first match wins. More specific rules
// (with `when` predicates) must come before generic ones for the same
// (status, role) pair.
// ─────────────────────────────────────────────────────────────────────────────

export const LAYOUT_RULES: readonly LayoutRule[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // Unseated
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Unseated, role: 'host' },
    layout: {
      primary: [{ source: 'static', button: 'settings' }],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: { status: GameStatus.Unseated, role: 'player' },
    layout: {
      primary: [{ source: 'static', button: 'waitForHost' }],
      secondary: [],
      ghost: [],
    },
  },
  // spectator: no panel

  // ═══════════════════════════════════════════════════════════════════════════
  // Seated
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Seated, role: 'host' },
    layout: {
      primary: [{ source: 'static', button: 'prepareToFlip' }],
      secondary: [],
      ghost: [{ source: 'static', button: 'settings' }],
    },
  },
  {
    match: { status: GameStatus.Seated, role: 'player' },
    layout: {
      primary: [{ source: 'static', button: 'waitForHost' }],
      secondary: [],
      ghost: [],
    },
  },
  // spectator: no panel

  // ═══════════════════════════════════════════════════════════════════════════
  // Assigned
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Assigned, role: 'host' },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [{ source: 'static', button: 'restart' }],
    },
  },
  {
    match: { status: GameStatus.Assigned, role: 'player' },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [],
    },
  },
  // spectator: no panel

  // ═══════════════════════════════════════════════════════════════════════════
  // Ready
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Ready, role: 'host' },
    layout: {
      primary: [{ source: 'static', button: 'startGame' }],
      secondary: [],
      ghost: [
        { source: 'static', button: 'viewRole' },
        { source: 'static', button: 'restart' },
      ],
    },
  },
  {
    match: { status: GameStatus.Ready, role: 'player' },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [],
    },
  },
  // spectator: no panel

  // ═══════════════════════════════════════════════════════════════════════════
  // Ongoing — actioner during audio playback (more specific rules first)
  // Schema action buttons are replaced with a disabled "语音播报中" placeholder
  // so the user knows the system is waiting on audio rather than seeing the
  // panel collapse to viewRole-only.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'host',
      when: (ctx) => ctx.imActioner && ctx.isAudioPlaying,
    },
    layout: {
      primary: [{ source: 'static', button: 'audioWaiting' }],
      secondary: [],
      ghost: [
        { source: 'static', button: 'viewRole' },
        { source: 'static', button: 'restart' },
      ],
    },
  },
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'player',
      when: (ctx) => ctx.imActioner && ctx.isAudioPlaying,
    },
    layout: {
      primary: [{ source: 'static', button: 'audioWaiting' }],
      secondary: [],
      ghost: [{ source: 'static', button: 'viewRole' }],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Ongoing — actioner (audio idle)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'host',
      when: (ctx) => ctx.imActioner,
    },
    layout: {
      primary: [{ source: 'schema', tier: 'primary' }],
      secondary: [{ source: 'schema', tier: 'secondary' }],
      ghost: [
        { source: 'static', button: 'viewRole' },
        { source: 'static', button: 'restart' },
      ],
    },
  },
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'player',
      when: (ctx) => ctx.imActioner,
    },
    layout: {
      primary: [{ source: 'schema', tier: 'primary' }],
      secondary: [{ source: 'schema', tier: 'secondary' }],
      ghost: [{ source: 'static', button: 'viewRole' }],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Ongoing — non-actioner
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Ongoing, role: 'host' },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [{ source: 'static', button: 'restart' }],
    },
  },
  {
    match: { status: GameStatus.Ongoing, role: 'player' },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [],
    },
  },
  // spectator: no panel

  // ═══════════════════════════════════════════════════════════════════════════
  // Ended
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Ended, role: 'host' },
    layout: {
      // Ended: "restart" is the primary CTA (next game), uses primary variant
      primary: [{ source: 'static', button: 'restart' }],
      secondary: [],
      ghost: [
        { source: 'static', button: 'viewRole' },
        { source: 'static', button: 'nightReview' },
        { source: 'static', button: 'lastNightInfo' },
      ],
    },
  },
  {
    match: {
      status: GameStatus.Ended,
      role: 'player',
      when: (ctx) =>
        ctx.effectiveSeat !== null && ctx.nightReviewAllowedSeats.includes(ctx.effectiveSeat),
    },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [{ source: 'static', button: 'nightReview' }],
    },
  },
  {
    match: { status: GameStatus.Ended, role: 'player' },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: { status: GameStatus.Ended, role: 'spectator' },
    layout: {
      primary: [{ source: 'static', button: 'nightReview' }],
      secondary: [],
      ghost: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Empty layout constant (avoid allocating new objects)
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_LAYOUT: BottomLayout = {
  primary: [],
  secondary: [],
  ghost: [],
} as const;
