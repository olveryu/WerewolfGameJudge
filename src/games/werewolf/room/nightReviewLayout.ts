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
// screenshot capture composites bands and a gradient would seam). A seat
// number appears exactly once per mention: on its SeatMedal. Copy that
// names a role as a sentence subject lives on row subjects and identity
// statements; inline targets are medals. Actions group by the actor's
// faction, each group carrying a faction-colored rail.
// ─────────────────────────────────────────────────────────────────────────────

/** Semantic slots of the report palette, composed from the theme hues. */
export const NIGHT_REPORT_PALETTE = {
  background: NIGHT_REPORT_COLORS.background,
  cardBorder: NIGHT_REPORT_COLORS.cardBorder,
  divider: NIGHT_REPORT_COLORS.divider,
  text: NIGHT_REPORT_COLORS.text,
  textSecondary: NIGHT_REPORT_COLORS.textSecondary,
  textMuted: NIGHT_REPORT_COLORS.textMuted,
  textFaint: NIGHT_REPORT_COLORS.textFaint,
  danger: NIGHT_REPORT_COLORS.danger,
  /** Top accent bar. */
  accent: colors.primary,
  /** Hairline rules of the stats ledger (dark, print-like). */
  rule: NIGHT_REPORT_COLORS.text,
  /** Death stamp: danger outline, filled danger medal with inverse numeral. */
  stampBorder: NIGHT_REPORT_COLORS.danger,
  stampMedal: {
    bg: NIGHT_REPORT_COLORS.danger,
    text: colors.textInverse,
  },
  /** Faction rail on the left edge of each action group. */
  rail: {
    wolf: NIGHT_REPORT_COLORS.wolfMedalText,
    god: NIGHT_REPORT_COLORS.violet,
    villager: NIGHT_REPORT_COLORS.goodMedalText,
    third: colors.third,
    neutral: NIGHT_REPORT_COLORS.textMuted,
  },
  /** Wolf verdict band under the wolf team row. */
  verdictBg: NIGHT_REPORT_COLORS.wolfMedalBg,
  hitMedalBg: colors.primary,
  // The hit medal is a filled primary disc: its numeral stays inverse
  // (white) even though the report's text slots are now dark-on-light.
  hitMedalText: colors.textInverse,
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
  tagBad: {
    bg: NIGHT_REPORT_COLORS.deadMedalBg,
    text: NIGHT_REPORT_COLORS.dangerText,
  },
  tagGood: {
    bg: NIGHT_REPORT_COLORS.goodMedalBg,
    text: NIGHT_REPORT_COLORS.goodMedalText,
  },
  tagInfo: {
    bg: NIGHT_REPORT_COLORS.godMedalBg,
    text: NIGHT_REPORT_COLORS.violet,
  },
  tagMuted: {
    bg: NIGHT_REPORT_COLORS.neutralMedalBg,
    text: NIGHT_REPORT_COLORS.textSecondary,
  },
} as const;

/** SeatMedal diameters by slot (death stamp / group row / inline / roster row). */
export const NIGHT_REPORT_MEDAL_SIZES = {
  large: 44,
  medium: 28,
  small: 24,
  roster: 26,
} as const;

/** Kicker line at the top of the report. */
export const NIGHT_REPORT_KICKER = '🌙 第一夜 · 夜报';

/** Section title above the key action cards. */
export const NIGHT_REPORT_ACTIONS_TITLE = '关键行动';

/** Row tag on an actor who did not use their ability tonight. */
export const NIGHT_REPORT_IDLE_TAG = '未行动';

/** Section title above the sheriff election card. */
export const NIGHT_REPORT_SHERIFF_TITLE = '警长竞选';

/** Footer line at the bottom of the report. */
export const NIGHT_REPORT_FOOTER_TEXT = '仅供裁判及观战者参考 · 本夜报由对局记录自动生成';

/** Stats strip labels, in strip order. */
export const NIGHT_REPORT_STAT_LABELS = {
  wolfKill: '狼杀',
  poison: '毒杀',
  save: '救活',
  check: '查验',
} as const;

/** Wolf-team verdict lines (card footer / text channel), by verdict type. */
export const NIGHT_REPORT_WOLF_VERDICT_SHARED = '狼队共同目标';
export const NIGHT_REPORT_WOLF_VERDICT_SPLIT_KILLED = '狼队目标不一致 — 按多数票击杀';
export const NIGHT_REPORT_WOLF_VERDICT_TIE_PICKED = '狼队目标不一致 — 平票抽中目标';
export const NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED = '狼队目标不一致 — 平票，未击杀';
export const NIGHT_REPORT_WOLF_VERDICT_TIE_PENDING = '狼队目标不一致 — 平票，目标未记录';
export const NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN = '狼队全员空刀';

/** Wolf-team card header tags, by outcome. */
export const NIGHT_REPORT_WOLF_TAG_KILLED = '击杀成立';
export const NIGHT_REPORT_WOLF_TAG_SURVIVED = '目标存活';
export const NIGHT_REPORT_WOLF_TAG_TIED = '平票未击杀';
export const NIGHT_REPORT_WOLF_TAG_TIE_PENDING = '平票未记录';
export const NIGHT_REPORT_WOLF_TAG_ABSTAIN = '空刀';

/** Roster cell status for a seat still alive. */
export const NIGHT_REPORT_ROSTER_ALIVE = '存活';

/** Roster cell status for a seat out with no recorded reason. */
export const NIGHT_REPORT_ROSTER_OUT = '已出局';

/** Suffix composing a death-reason label into a death cause （狼杀出局）. */
export const NIGHT_REPORT_DEATH_CAUSE_SUFFIX = '出局';
