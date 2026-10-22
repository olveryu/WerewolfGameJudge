/**
 * nightReviewLayout - The one layout/copy spec for the werewolf night review report.
 *
 * Every surface that presents NightReviewData — the in-room modal, the DOM share
 * card, and the mini-program Canvas fallback renderer — reads its card geometry
 * and shared copy from here, so the surfaces cannot drift apart. Font sizes,
 * spacing and radii stay sourced from @/theme tokens directly.
 */

/** Card width as a fraction of the window width, shared by all three surfaces. */
export const NIGHT_REVIEW_CARD_WIDTH_RATIO = 0.88;

/** Section title above the night action entries. */
export const NIGHT_REVIEW_ACTIONS_TITLE = '第一夜 · 行动';

/** Section title above the identity grid. */
export const NIGHT_REVIEW_IDENTITIES_TITLE = '全员身份';

/** Outcome hero headline for a peaceful night (no deaths). */
export const NIGHT_REVIEW_PEACEFUL_HEADLINE = '昨夜平安夜';

/** Outcome hero sub-line shown under the peaceful-night headline. */
export const NIGHT_REVIEW_PEACEFUL_SUB = '无人出局';

/** Section title above the muted noise zone (idle / confirmation-only entries). */
export const NIGHT_REVIEW_NOISE_TITLE = '未行动 · 状态确认';

/** Sub-line under the wolf attack row when the wolves split their votes across targets. */
export const NIGHT_REVIEW_WOLF_SPLIT_SUB = '狼队目标不一致';

/** Outcome hero headline for a night with deaths, by death count. */
export function formatNightReviewOutcomeHeadline(deathCount: number): string {
  return `昨夜 ${deathCount} 人出局`;
}

/** Fair-play disclaimer shown on every review surface. */
export const NIGHT_REVIEW_DISCLAIMER_TEXT = '仅供裁判及观战者参考';

/** Title of the share card / canvas report image. */
export function formatNightReviewShareTitle(roomCode: string): string {
  return `房间 ${roomCode} 战报`;
}
