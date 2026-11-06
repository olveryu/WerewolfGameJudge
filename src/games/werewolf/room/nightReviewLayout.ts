/**
 * nightReviewLayout - The one layout/copy spec for the werewolf night review report.
 *
 * Every surface that presents NightReviewData — the in-room modal and the DOM
 * share card — reads its card geometry and shared copy from here, so the
 * surfaces cannot drift apart. Font sizes, spacing and radii stay sourced
 * from @/theme tokens directly.
 */

import { colors, NIGHT_REPORT_COLORS } from '@/theme';

/** Card width as a fraction of the window width, shared by all three surfaces. */
export const NIGHT_REVIEW_CARD_WIDTH_RATIO = 0.88;

/** Section title above the identity grid. */
export const NIGHT_REVIEW_IDENTITIES_TITLE = '全员身份';

/** Outcome hero headline for a peaceful night (no deaths). */
export const NIGHT_REVIEW_PEACEFUL_HEADLINE = '昨夜平安夜';

/** Outcome headline parts for a night with deaths: `昨夜 <N> 人出局`, N as the display numeral. */
export const NIGHT_REPORT_HEADLINE_PREFIX = '昨夜 ';
export const NIGHT_REPORT_HEADLINE_SUFFIX = ' 人出局';

/** Title of the share card image. */
export function formatNightReviewShareTitle(roomCode: string): string {
  return `房间 ${roomCode} 战报`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2026 report spec — the white "verdict ticket".
//
// The DOM body is printed on NIGHT_REPORT_PALETTE, a light palette aligned
// with the app theme (flat colors only, no gradients — the segmented
// screenshot capture composites bands and a gradient would seam). The
// action area is a text timeline: one sentence per action, in night
// order, behind a rail of dots; a verb is colored by its actor's faction,
// a role word by that role's faction, a dead seat's number by the dead
// player's faction (theme colors via FACTION_COLOR_MAP), and words with
// no faction to point at stay in the body text color. There are no
// portraits, no role tags, no columns, no alignment arithmetic, no ✗
// discs, and no stats strip: the last line states the outcome (who died,
// or that nobody did). A seat number appears in the sentence that names
// it, and in its medal in the roster and the death stamps.
// ─────────────────────────────────────────────────────────────────────────────

/** Semantic slots of the report palette, composed from the theme hues. */
export const NIGHT_REPORT_PALETTE = {
  background: NIGHT_REPORT_COLORS.background,
  cardBorder: NIGHT_REPORT_COLORS.cardBorder,
  divider: NIGHT_REPORT_COLORS.divider,
  text: NIGHT_REPORT_COLORS.text,
  textSecondary: NIGHT_REPORT_COLORS.textSecondary,
  textMuted: NIGHT_REPORT_COLORS.textMuted,
  danger: NIGHT_REPORT_COLORS.danger,
  /** Top accent bar. */
  accent: colors.primary,
  /** Death stamp: danger outline, filled danger medal with inverse numeral. */
  stampBorder: NIGHT_REPORT_COLORS.danger,
  stampMedal: {
    bg: NIGHT_REPORT_COLORS.danger,
    text: colors.textInverse,
  },
  /** Rail on the left edge of the sheriff group (the only remaining grouped section). */
  rail: {
    wolf: NIGHT_REPORT_COLORS.wolfMedalText,
    god: NIGHT_REPORT_COLORS.violet,
    villager: NIGHT_REPORT_COLORS.goodMedalText,
    third: colors.third,
    neutral: NIGHT_REPORT_COLORS.textMuted,
  },
  medalNeutral: {
    bg: NIGHT_REPORT_COLORS.neutralMedalBg,
    border: NIGHT_REPORT_COLORS.neutralMedalBorder,
    text: NIGHT_REPORT_COLORS.text,
  },
  medalWolf: {
    bg: NIGHT_REPORT_COLORS.wolfMedalBg,
    border: NIGHT_REPORT_COLORS.wolfMedalBorder,
    text: NIGHT_REPORT_COLORS.wolfMedalText,
  },
  medalGod: {
    bg: NIGHT_REPORT_COLORS.godMedalBg,
    border: NIGHT_REPORT_COLORS.godMedalBorder,
    text: NIGHT_REPORT_COLORS.godMedalText,
  },
  medalGood: {
    bg: NIGHT_REPORT_COLORS.goodMedalBg,
    border: NIGHT_REPORT_COLORS.goodMedalBorder,
    text: NIGHT_REPORT_COLORS.goodMedalText,
  },
  medalDead: {
    bg: NIGHT_REPORT_COLORS.deadMedalBg,
    border: NIGHT_REPORT_COLORS.deadMedalBorder,
    text: NIGHT_REPORT_COLORS.dangerText,
  },
} as const;

/** SeatMedal diameters by slot (death stamp / roster row). */
export const NIGHT_REPORT_MEDAL_SIZES = {
  large: 44,
  roster: 26,
} as const;

/** Kicker line at the top of the report. */
export const NIGHT_REPORT_KICKER = '🌙 第一夜 · 夜报';

/** Section title above the timeline: the review carries first-night facts only. */
export const NIGHT_REPORT_TIMELINE_TITLE = '第一夜';

/** Section title above the sheriff election card. */
export const NIGHT_REPORT_SHERIFF_TITLE = '警长竞选';

/** Footer line at the bottom of the report. */
export const NIGHT_REPORT_FOOTER_TEXT = '仅供裁判及观战者参考 · 本夜报由对局记录自动生成';

/** Roster cell status for a seat still alive. */
export const NIGHT_REPORT_ROSTER_ALIVE = '存活';

/** Roster cell status for a seat out with no recorded reason. */
export const NIGHT_REPORT_ROSTER_OUT = '已出局';

/** Suffix composing a death-reason label into a death cause （狼杀出局）. */
export const NIGHT_REPORT_DEATH_CAUSE_SUFFIX = '出局';
