/**
 * EmojiTokens — 保留的 Emoji 语义 Token
 *
 * 仅包含无法替换为 Ionicons 的场景：
 * - BRAND：品牌标识（角色形象 emoji）
 * - ACTION：夜间行动前缀（密集文本行锚点，嵌入 Ionicons 复杂度高收益低）
 * - STATUS（余留）：出现在纯字符串模板中（NightReview / useSpeakingOrder），无法嵌入 JSX
 * - CELEBRATION_EMOJIS：粒子特效（Text 渲染，非 Ionicons 组件）
 *
 * 已迁移至 Ionicons 的 token 见 iconTokens.ts（UI_ICONS / STATUS_ICONS）。
 * 角色 emoji 仍由 specs.ts 的 emoji 字段定义。
 * 不含业务逻辑 / 副作用 / 运行时依赖。
 */

// ── Brand ────────────────────────────────────────────────────

export const BRAND = {
  APP: '🐺',
} as const;

// ── Night action prefixes ────────────────────────────────────

export const ACTION = {
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

// ── Game / system status（仅保留纯字符串模板中使用的条目）─────

export const STATUS = {
  PEACEFUL_NIGHT: '🌙',
  DEATH: '💀',
  SPEAKING: '🎙️',
} as const;

// ── Visual effects (shared across role reveal animations) ────

export const CELEBRATION_EMOJIS = ['⭐', '✨', '🎉', '🎊', '💫', '🌟', '🏆'] as const;
