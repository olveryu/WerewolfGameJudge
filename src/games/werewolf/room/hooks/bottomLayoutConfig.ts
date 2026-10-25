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
import { TERMINAL_ACTION_VARIANT } from '@/features/room/model/hostManagementActions';
import { AUDIO_WAITING_LABEL, VIEW_IDENTITY_LABEL } from '@/features/room/model/RoomBottomActions';
import type { PanelFlowProgress, PanelFlowViewer } from '@/games/werewolf/room/panelFlow';
import { resolvePanelFlowCurrentStep } from '@/games/werewolf/room/panelFlow';
import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import { TESTIDS } from '@/testids';

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

interface ButtonConfigBase {
  readonly key: string;
  readonly label: string;
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

export type StaticButtonId =
  | 'viewRole'
  | 'waitForHost'
  | 'audioWaiting'
  | 'nightReview'
  | 'lastNightInfo'
  | 'nextRound'
  | 'returnToLobby';

/** Static entries that represent real user intent. Display-only entries are excluded. */
export type StaticButtonAction = Exclude<StaticButtonId, 'audioWaiting' | 'waitForHost'>;

// ─────────────────────────────────────────────────────────────────────────────
// Static button definitions
// ─────────────────────────────────────────────────────────────────────────────

interface StaticButtonDef {
  label: string;
  testID?: string;
  /**
   * Display variant used instead of the tier-derived variant when this
   * button is materialized (the closing actions render danger inside
   * the secondary row). Absent = variant follows the layout tier.
   */
  variantOverride?: typeof TERMINAL_ACTION_VARIANT;
}

export const STATIC_BUTTONS: Record<StaticButtonId, StaticButtonDef> = {
  viewRole: {
    label: VIEW_IDENTITY_LABEL,
  },
  waitForHost: {
    label: '等待房主开始',
  },
  audioWaiting: {
    label: AUDIO_WAITING_LABEL,
    testID: TESTIDS.audioWaitingButton,
  },
  nightReview: {
    label: '本局复盘',
    testID: TESTIDS.nightReviewBottomButton,
  },
  lastNightInfo: {
    label: '昨夜信息',
    testID: TESTIDS.lastNightInfoBottomButton,
  },
  // Closing actions of the Day/Ended panel flow — the same actions as
  // the host-management sheet's buildNextRoundAction /
  // buildReturnLobbyAction （再来一局 = host control 'redeal',
  // 返回大厅 = 'returnToLobby' for the host, leaving the room for
  // everyone else), surfaced in the secondary row. The variant is the
  // shared builders' TERMINAL_ACTION_VARIANT — one definition of how
  // these actions look, read by both surfaces.
  nextRound: {
    label: '再来一局',
    testID: TESTIDS.nextRoundBottomButton,
    variantOverride: TERMINAL_ACTION_VARIANT,
  },
  returnToLobby: {
    label: '返回大厅',
    testID: TESTIDS.returnLobbyBottomButton,
    variantOverride: TERMINAL_ACTION_VARIANT,
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
  /**
   * Local progress of the Day/Ended panel flow for the current game
   * (client-only state, never room state). Drives which flow step the
   * Day/Ended rules surface.
   */
  panelFlow: PanelFlowProgress;
}

/** Review gate shared by the Day rules: a seat the game marked review-authorized. */
function isNightReviewAllowed(ctx: LayoutContext) {
  return ctx.effectiveSeat !== null && ctx.nightReviewAllowedSeats.includes(ctx.effectiveSeat);
}

/**
 * The panel-flow viewer facts for this context, derived from the same
 * role split the layout rules match on. `reviewShared` reads the
 * engine's nightReviewAllowedSeats: the host has shared the review
 * when the set is non-empty.
 */
function panelFlowViewer(ctx: LayoutContext): PanelFlowViewer {
  return {
    role: ctx.isHost ? 'host' : ctx.effectiveSeat !== null ? 'player' : 'spectator',
    reviewShared: ctx.nightReviewAllowedSeats.length > 0,
  };
}

/** True when the Day/Ended panel flow currently guides towards `step`. */
function isPanelFlowStep(ctx: LayoutContext, step: 'lastNightInfo' | 'nightReview' | 'closing') {
  return resolvePanelFlowCurrentStep(ctx.roomStatus, ctx.panelFlow, panelFlowViewer(ctx)) === step;
}

/** True when the Day flow's only step is done and the phase's own actions resume. */
function isPanelFlowPaused(ctx: LayoutContext) {
  return resolvePanelFlowCurrentStep(ctx.roomStatus, ctx.panelFlow, panelFlowViewer(ctx)) === null;
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
      when: (ctx) => isAudioPlaybackLocked(ctx.isAudioPlaying),
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
      when: (ctx) => isAudioPlaybackLocked(ctx.isAudioPlaying),
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
      role: 'player',
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
    match: { status: GameStatus.Ongoing, role: 'player' },
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
      primary: [{ source: 'static', button: 'audioWaiting' }],
      secondary: [],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Day,
      role: 'player',
      when: (ctx) => isAudioPlaybackLocked(ctx.isAudioPlaying),
    },
    layout: {
      primary: [{ source: 'static', button: 'audioWaiting' }],
      secondary: [],
      ghost: [],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Day — panel flow, first step （昨夜信息）, host only. The step is
  // the panel's only primary; view identity stays reachable as a
  // secondary tool, the review as a ghost tool (the review also feeds
  // the sheriff-election dock's trailing tool). Once the step is
  // confirmed the flow pauses: the phase's own actions resume and
  // the info demotes to a ghost tool.
  //
  // Players never join the flow — every flow action is a host
  // action. Their Day panel is their own surface: the view-identity
  // secondary tool, plus the review as a ghost tool when the host
  // shared it with their seat (the one host action a player may
  // ever see, and only because it was given to them).
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: {
      status: GameStatus.Day,
      role: 'host',
      when: (ctx) => isPanelFlowStep(ctx, 'lastNightInfo'),
    },
    layout: {
      primary: [{ source: 'static', button: 'lastNightInfo' }],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [{ source: 'static', button: 'nightReview' }],
    },
  },
  {
    match: { status: GameStatus.Day, role: 'host', when: (ctx) => isPanelFlowPaused(ctx) },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [
        { source: 'static', button: 'lastNightInfo' },
        { source: 'static', button: 'nightReview' },
      ],
    },
  },
  {
    match: {
      status: GameStatus.Day,
      role: 'player',
      when: (ctx) => isNightReviewAllowed(ctx),
    },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [{ source: 'static', button: 'nightReview' }],
    },
  },
  {
    match: { status: GameStatus.Day, role: 'player' },
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
  // Ended — panel flow （昨夜信息 → 本局复盘 → 收尾）, host only. One
  // primary per step; the closing step is the danger row in the
  // secondary tier. Progress made during Day carries over: a
  // confirmed first step is never asked again.
  //
  // Players have no Ended flow and no closing step: their panel is
  // the view-identity secondary tool, plus the review as a ghost tool
  // when the host shared it with their seat.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    match: {
      status: GameStatus.Ended,
      role: 'host',
      when: (ctx) => isPanelFlowStep(ctx, 'lastNightInfo'),
    },
    layout: {
      primary: [{ source: 'static', button: 'lastNightInfo' }],
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
      role: 'host',
      when: (ctx) => isPanelFlowStep(ctx, 'nightReview'),
    },
    layout: {
      primary: [{ source: 'static', button: 'nightReview' }],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Ended,
      role: 'host',
      when: (ctx) => isPanelFlowStep(ctx, 'closing'),
    },
    layout: {
      primary: [],
      secondary: [
        { source: 'static', button: 'nextRound' },
        { source: 'static', button: 'returnToLobby' },
        { source: 'static', button: 'viewRole' },
      ],
      ghost: [],
    },
  },
  {
    match: {
      status: GameStatus.Ended,
      role: 'player',
      when: (ctx) => isNightReviewAllowed(ctx),
    },
    layout: {
      primary: [],
      secondary: [{ source: 'static', button: 'viewRole' }],
      ghost: [{ source: 'static', button: 'nightReview' }],
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
];

// ─────────────────────────────────────────────────────────────────────────────
// Empty layout constant (avoid allocating new objects)
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_LAYOUT: BottomLayout = {
  primary: [],
  secondary: [],
  ghost: [],
} as const;
