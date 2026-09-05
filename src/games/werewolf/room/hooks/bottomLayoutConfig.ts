/**
 * bottomLayoutConfig — Declarative bottom panel layout system.
 *
 * Defines the three-tier button layout model (primary / secondary / ghost),
 * a static button registry, and the LAYOUT_RULES table that maps
 * (GameStatus × user role × conditions) → button layout.
 *
 * Pure data — no React, no hooks, no side effects.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import { TESTIDS } from '@/testids';

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

interface ButtonConfigBase {
  readonly key: string;
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost';
  readonly size: 'lg' | 'md';
  readonly testID?: string;
}

export type ButtonBehavior =
  | { readonly kind: 'intent'; readonly intent: ActionIntent }
  | { readonly kind: 'static'; readonly action: StaticButtonAction };

/** Fully resolved button with exactly one enabled or disabled interaction contract. */
export type ButtonConfig = ButtonConfigBase &
  (
    | {
        readonly isEnabled: true;
        readonly behavior: ButtonBehavior;
      }
    | {
        readonly isEnabled: false;
        readonly disabledReason: string | null;
        readonly onDisabledBehavior: ButtonBehavior | null;
      }
  );

/** The three-tier layout produced by resolveBottomLayout. */
export interface BottomLayout {
  primary: readonly ButtonConfig[];
  secondary: readonly ButtonConfig[];
  ghost: readonly ButtonConfig[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Static button IDs
// ─────────────────────────────────────────────────────────────────────────────

export type StaticButtonId = 'viewRole' | 'waitForHost' | 'audioWaiting' | 'nightReview';

/** Static entries that represent real user intent. Display-only entries are excluded. */
export type StaticButtonAction = Exclude<StaticButtonId, 'audioWaiting'>;

// ─────────────────────────────────────────────────────────────────────────────
// Static button definitions
// ─────────────────────────────────────────────────────────────────────────────

interface StaticButtonDef {
  label: string;
  testID?: string;
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
  nightReview: {
    label: '本局复盘',
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
      primary: [],
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
      primary: [],
      secondary: [],
      ghost: [],
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
      ghost: [],
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
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [],
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
  // Ongoing — audio playback gate
  // Host is the audio broadcaster for ALL night steps (not just their own role).
  // While audio is playing, the panel is fully locked: only the disabled
  // "语音播报中" placeholder is shown. No other buttons — everyone is "闭眼".
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'host',
      when: (ctx) => ctx.isAudioPlaying,
    },
    layout: {
      primary: [{ source: 'static', button: 'audioWaiting' }],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'player',
      when: (ctx) => ctx.isAudioPlaying,
    },
    layout: {
      primary: [{ source: 'static', button: 'audioWaiting' }],
      secondary: [],
      ghost: [],
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
      ghost: [{ source: 'static', button: 'viewRole' }],
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
      ghost: [],
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
  // Day — sheriff election owns the contextual action; keep room tools visible
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Day, role: 'host' },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Day,
      role: 'player',
      when: (ctx) =>
        ctx.effectiveSeat !== null && ctx.nightReviewAllowedSeats.includes(ctx.effectiveSeat),
    },
    layout: {
      primary: [{ source: 'static', button: 'viewRole' }],
      secondary: [{ source: 'static', button: 'nightReview' }],
      ghost: [],
    },
  },
  {
    match: { status: GameStatus.Day, role: 'player' },
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
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
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
      primary: [],
      secondary: [
        { source: 'static', button: 'viewRole' },
        { source: 'static', button: 'nightReview' },
      ],
      ghost: [],
    },
  },
  {
    match: { status: GameStatus.Ended, role: 'player' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
    },
  },
  {
    match: { status: GameStatus.Ended, role: 'spectator' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'nightReview' }],
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
