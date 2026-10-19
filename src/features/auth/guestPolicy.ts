/**
 * Guest (anonymous) access policy — the single client source for how
 * guest limits are worded and where guests are sent to upgrade.
 *
 * Product policy: anonymous accounts are trial guests. They can join
 * and play rooms, but growth (XP, draws, unlocks) is not accumulated —
 * the server enforces this (`ANONYMOUS_NOT_SUPPORTED`); these strings
 * state the same policy wherever the client intercepts a guest, so the
 * surfaces cannot drift into separate wordings.
 */

/** Policy sentence shown wherever a guest hits a growth surface. */
export const GUEST_GROWTH_NOTICE = '访客试玩不累计成长，绑定邮箱后开启';

/** AuthLogin route params that open the bind-email (upgrade) flow for a guest. */
export const GUEST_UPGRADE_LOGIN_PARAMS = {
  loginTitle: '绑定邮箱',
  loginSubtitle: GUEST_GROWTH_NOTICE,
} as const;
