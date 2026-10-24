/**
 * EmojiTokens — retained emoji semantic tokens
 *
 * Contains only cases that cannot be replaced with Ionicons:
 * - CELEBRATION_EMOJIS: particle effects (rendered as Text, not Ionicons components)
 *
 * Tokens migrated to Ionicons are in iconTokens.ts (UI_ICONS / STATUS_ICONS).
 * Role emojis are still defined by the emoji field in specs.ts.
 * No business logic / side effects / runtime dependencies.
 */

// ── Visual effects (shared across role reveal animations) ────

/** Emoji collection for celebration particle effects (rendered as Text, not Ionicons). */
export const CELEBRATION_EMOJIS = ['⭐', '✨', '🎉', '🎊', '💫', '🌟', '🏆'] as const;
