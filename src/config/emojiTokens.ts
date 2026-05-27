/**
 * EmojiTokens — retained emoji semantic tokens
 *
 * Contains only cases that cannot be replaced with Ionicons:
 * - ACTION: night action prefixes (dense text line anchors; embedding Ionicons is high-cost/low-gain)
 * - STATUS (residual): appears in plain string templates (NightReview / useSpeakingOrder), cannot be embedded in JSX
 * - CELEBRATION_EMOJIS: particle effects (rendered as Text, not Ionicons components)
 *
 * Tokens migrated to Ionicons are in iconTokens.ts (UI_ICONS / STATUS_ICONS).
 * Role emojis are still defined by the emoji field in specs.ts.
 * No business logic / side effects / runtime dependencies.
 */

// ── Night action prefixes ────────────────────────────────────
/** Night action prefix emojis, used as dense text line anchors. */ export const ACTION = {
  CHECK: '🔍',
  KILL: '💀',
  SAVE: '💊',
  POISON: '☠️',
  GUARD: '🛡️',
  BLOCK: '⛔',
  CHARM: '💋',
  CONVERT: '🔄',
  LEARN: '📖',
  SHOOT: '🏹',
} as const;

// ── Game / system status (only entries used in plain string templates) ─────

/** Game/system status emojis, used only in plain string templates (NightReview / useSpeakingOrder). */
export const STATUS = {
  PEACEFUL_NIGHT: '🌙',
  DEATH: '💀',
  SPEAKING: '🎙️',
} as const;

// ── Visual effects (shared across role reveal animations) ────

/** Emoji collection for celebration particle effects (rendered as Text, not Ionicons). */
export const CELEBRATION_EMOJIS = ['⭐', '✨', '🎉', '🎊', '💫', '🌟', '🏆'] as const;
