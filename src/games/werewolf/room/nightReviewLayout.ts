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

/** Outcome hero headline for a night with deaths, by death count. */
export function formatNightReviewOutcomeHeadline(deathCount: number): string {
  return `昨夜 ${deathCount} 人出局`;
}

/** Title of the share card image. */
export function formatNightReviewShareTitle(roomCode: string): string {
  return `房间 ${roomCode} 战报`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2026 report spec — the light-surface night report.
//
// The DOM body is printed on NIGHT_REPORT_PALETTE, a light palette aligned
// with the app theme (flat colors only, no gradients — the segmented
// screenshot capture composites bands and a gradient would seam). A seat
// number appears exactly once per mention: on its SeatMedal. Copy that
// names a role as a sentence subject lives on card heads and identity
// statements; inline targets are medals.
// ─────────────────────────────────────────────────────────────────────────────

/** Semantic slots of the report palette, composed from the theme hues. */
export const NIGHT_REPORT_PALETTE = {
  background: NIGHT_REPORT_COLORS.background,
  card: NIGHT_REPORT_COLORS.card,
  cardBorder: NIGHT_REPORT_COLORS.cardBorder,
  divider: NIGHT_REPORT_COLORS.divider,
  text: NIGHT_REPORT_COLORS.text,
  textSecondary: NIGHT_REPORT_COLORS.textSecondary,
  textMuted: NIGHT_REPORT_COLORS.textMuted,
  textFaint: NIGHT_REPORT_COLORS.textFaint,
  danger: NIGHT_REPORT_COLORS.danger,
  dangerText: NIGHT_REPORT_COLORS.dangerText,
  violet: NIGHT_REPORT_COLORS.violet,
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
  idleBg: NIGHT_REPORT_COLORS.idleBg,
  idleBorder: NIGHT_REPORT_COLORS.cardBorder,
  idleText: NIGHT_REPORT_COLORS.idleText,
  idleStrong: NIGHT_REPORT_COLORS.idleStrong,
  rosterOutMedal: {
    bg: NIGHT_REPORT_COLORS.rosterOutMedalBg,
    border: NIGHT_REPORT_COLORS.rosterOutMedalBorder,
    text: NIGHT_REPORT_COLORS.rosterOutMedalText,
  },
} as const;

/** SeatMedal diameters by slot (death card / card head / inline / roster). */
export const NIGHT_REPORT_MEDAL_SIZES = {
  large: 42,
  medium: 34,
  small: 24,
  roster: 38,
} as const;

/** Kicker line at the top of the report. */
export const NIGHT_REPORT_KICKER = '🌙 第一夜 · 夜报';

/** Section title above the key action cards. */
export const NIGHT_REPORT_ACTIONS_TITLE = '关键行动';

/** Section title above the did-not-act strip. */
export const NIGHT_REPORT_IDLE_TITLE = '未行动';

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
export const NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED = '狼队目标不一致 — 平票，未击杀';
export const NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN = '狼队全员空刀';

/** Wolf-team card header tags, by outcome. */
export const NIGHT_REPORT_WOLF_TAG_KILLED = '击杀成立';
export const NIGHT_REPORT_WOLF_TAG_SURVIVED = '目标存活';
export const NIGHT_REPORT_WOLF_TAG_TIED = '平票未击杀';
export const NIGHT_REPORT_WOLF_TAG_ABSTAIN = '空刀';

/** Sheriff round labels, by round. */
export const NIGHT_REPORT_SHERIFF_ROUND_LABELS = {
  first: '首轮',
  runoff: '决选',
} as const;

/** Sheriff card head when a sheriff was elected. */
export const NIGHT_REPORT_SHERIFF_ELECTED_TITLE = '警长当选';

/** Sheriff card head when the election produced no sheriff. */
export const NIGHT_REPORT_SHERIFF_NONE_TITLE = '无警长';

/** Why an election produced no sheriff, by engine reason. */
export const NIGHT_REPORT_SHERIFF_REASON_LABELS = {
  noCandidates: '无人参选',
  noVotes: '无人投票',
  runoffTie: '决选平票',
  selfDestruct: '狼人自爆中断',
} as const;

/** Sheriff status tags for elections still in flight. */
export const NIGHT_REPORT_SHERIFF_REGISTRATION_STATUS = '报名中';
export const NIGHT_REPORT_SHERIFF_IN_PROGRESS = '进行中';
export const NIGHT_REPORT_SHERIFF_VOTING = '投票中';
export const NIGHT_REPORT_SHERIFF_RUNOFF_IN_PROGRESS = '决选进行中';

/** Sheriff card row labels. */
export const NIGHT_REPORT_SHERIFF_CANDIDATES_LABEL = '参选';
export const NIGHT_REPORT_SHERIFF_RUNOFF_CANDIDATES_LABEL = '决选候选';
export const NIGHT_REPORT_SHERIFF_WITHDRAWN_LABEL = '退选';
export const NIGHT_REPORT_SHERIFF_ABSTAIN_LABEL = '弃票';
export const NIGHT_REPORT_SHERIFF_VOTE_ROUND_SUFFIX = '投票';

/** Winner vote-share tag on the completed sheriff card head. */
export function formatNightReportSheriffVotesTag(votes: number, total: number): string {
  return `得票 ${votes} / ${total}`;
}

/** Roster cell status for a seat still alive. */
export const NIGHT_REPORT_ROSTER_ALIVE = '存活';

/** Roster cell status for a seat out with no recorded reason. */
export const NIGHT_REPORT_ROSTER_OUT = '已出局';

/** Suffix composing a death-reason label into a death cause （狼杀出局）. */
export const NIGHT_REPORT_DEATH_CAUSE_SUFFIX = '出局';
