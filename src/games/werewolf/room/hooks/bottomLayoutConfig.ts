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

import { isAudioPlaybackLocked } from '@/features/room/model/audioPlaybackLock';
import {
  type RoomBottomButton,
  type RoomBottomButtonAudience,
  VIEW_IDENTITY_LABEL,
} from '@/features/room/model/RoomBottomActions';
import type { RoomViewerAudience } from '@/features/room/model/RoomViewer';
import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import { TESTIDS } from '@/testids';

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

interface ButtonConfigBase {
  readonly key: string;
  readonly label: string;
  readonly audience: RoomBottomButtonAudience;
  readonly icon?: RoomBottomButton['icon'];
  readonly variant: 'primary' | 'secondary' | 'ghost' | 'danger';
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

export type StaticButtonId = 'viewRole' | 'nightReview';

/** Every static entry represents a real user intent. */
export type StaticButtonAction = StaticButtonId;

// ─────────────────────────────────────────────────────────────────────────────
// Static button definitions
// ─────────────────────────────────────────────────────────────────────────────

interface StaticButtonDef {
  label: string;
  /**
   * Declared ownership (room-shell-contract "Action Ownership"): view
   * identity is a seat action; the review is open to whoever the game
   * lets in (shared seats, spectators). Host flow never renders here —
   * it lives on the host task card.
   */
  audience: RoomBottomButtonAudience;
  icon: NonNullable<RoomBottomButton['icon']>;
  testID?: string;
}

export const STATIC_BUTTONS: Record<StaticButtonId, StaticButtonDef> = {
  viewRole: {
    label: VIEW_IDENTITY_LABEL,
    audience: 'participant',
    icon: 'eye-outline',
  },
  nightReview: {
    label: '本局复盘',
    audience: 'anyone',
    icon: 'document-text-outline',
    testID: TESTIDS.nightReviewBottomButton,
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

/** Review gate shared by the Day rules: a seat the game marked review-authorized. */
function isNightReviewAllowed(ctx: LayoutContext) {
  return ctx.effectiveSeat !== null && ctx.nightReviewAllowedSeats.includes(ctx.effectiveSeat);
}

/** What to put in a button slot. */
export type ButtonSlot =
  | { readonly source: 'schema'; readonly tier: 'primary' | 'secondary' }
  | { readonly source: 'static'; readonly button: StaticButtonId };

/** A single layout rule: condition → three-tier button placement. */
interface LayoutRule {
  readonly match: {
    readonly status: GameStatus | readonly GameStatus[];
    /** The viewer audience the rule applies to, keyed on the effective seat. */
    readonly role: RoomViewerAudience;
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
    match: { status: GameStatus.Unseated, role: 'seated' },
    layout: {
      primary: [],
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
    match: { status: GameStatus.Seated, role: 'seated' },
    layout: {
      primary: [],
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
    match: { status: GameStatus.Assigned, role: 'seated' },
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
    match: { status: GameStatus.Ready, role: 'seated' },
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
  // While audio plays, no actions are exposed. The adapter owns the audio status message.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'host',
      when: (ctx) => isAudioPlaybackLocked(ctx.isAudioPlaying),
    },
    layout: {
      primary: [],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'seated',
      when: (ctx) => isAudioPlaybackLocked(ctx.isAudioPlaying),
    },
    layout: {
      primary: [],
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
      secondary: [
        { source: 'schema', tier: 'secondary' },
        { source: 'static', button: 'viewRole' },
      ],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Ongoing,
      role: 'seated',
      when: (ctx) => ctx.imActioner,
    },
    layout: {
      primary: [{ source: 'schema', tier: 'primary' }],
      secondary: [
        { source: 'schema', tier: 'secondary' },
        { source: 'static', button: 'viewRole' },
      ],
      ghost: [],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Ongoing — non-actioner
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Ongoing, role: 'host' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
    },
  },
  {
    match: { status: GameStatus.Ongoing, role: 'seated' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
    },
  },
  // spectator: no panel

  // ═══════════════════════════════════════════════════════════════════════════
  // Day — audio playback gate (the night-end announcement window opens
  // Day with narration still playing; same collapse as Ongoing)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: {
      status: GameStatus.Day,
      role: 'host',
      when: (ctx) => isAudioPlaybackLocked(ctx.isAudioPlaying),
    },
    layout: {
      primary: [],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Day,
      role: 'seated',
      when: (ctx) => isAudioPlaybackLocked(ctx.isAudioPlaying),
    },
    layout: {
      primary: [],
      secondary: [],
      ghost: [],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Day — the host's flow (昨夜信息 → 本局复盘 → 收尾) lives on the host
  // task card and in host management, never here. The host's bottom
  // panel is their own participant surface: view identity. Players get
  // the review as a ghost tool only when the host shared it with their
  // seat; spectators' whole panel is the single review button.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Day, role: 'host' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Day,
      role: 'seated',
      when: (ctx) => isNightReviewAllowed(ctx),
    },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [{ source: 'static', button: 'nightReview' }],
    },
  },
  {
    match: { status: GameStatus.Day, role: 'seated' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
    },
  },
  // Spectators never join the flow, in any Day flow state: their
  // whole panel is the single review button.
  {
    match: { status: GameStatus.Day, role: 'spectator' },
    layout: {
      primary: [{ source: 'static', button: 'nightReview' }],
      secondary: [],
      ghost: [],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Ended — same split as Day: host flow on the task card; the host's
  // bottom panel keeps view identity only.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: { status: GameStatus.Ended, role: 'host' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
    },
  },
  // Spectators never join the flow: their whole panel is the single
  // review button, whatever the participants' flow progress is.
  {
    match: { status: GameStatus.Ended, role: 'spectator' },
    layout: {
      primary: [{ source: 'static', button: 'nightReview' }],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Ended,
      role: 'seated',
      when: (ctx) => isNightReviewAllowed(ctx),
    },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [{ source: 'static', button: 'nightReview' }],
    },
  },
  {
    match: { status: GameStatus.Ended, role: 'seated' },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
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
