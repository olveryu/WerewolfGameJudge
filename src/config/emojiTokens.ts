/**
 * EmojiTokens — 全局 Emoji 语义 Token 集中定义
 *
 * 所有 UI 层非角色类 emoji 的唯一来源。角色 emoji 仍由 specs.ts 的 emoji 字段定义，
 * 本文件管理品牌 / 阵营标签 / 行动前缀 / 系统状态 / 通用 UI 图标。
 *
 * 分层：BRAND / ACTION / STATUS / UI / FX
 * 设计原则：一义一符、禁止跨语义复用。
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

// ── Game / system status ─────────────────────────────────────

export const STATUS = {
  READY: '✅',
  PEACEFUL_NIGHT: '🌙',
  DEATH: '💀',
  WARNING: '⚠️',
  ERROR: '😵',
  SPEAKING: '🎙️',
} as const;

// ── Generic UI icons ─────────────────────────────────────────

export const UI = {
  HINT: '💡',
  EDIT: '✏️',
  NOTE: '📝',
  DELETE: '🗑️',
  CAMERA: '📷',
  EMAIL: '📧',
  SHARE: '📤',
  THEME: '🎨',
  USER: '👤',
  BOT: '🤖',
  GAMEPAD: '🎮',
  AUDIO: '🔊',
  GREETING: '👋',
  RECORD: '📋',
  ROLE_PLACEHOLDER: '❓',
} as const;

// ── Visual effects (shared across role reveal animations) ────

export const CELEBRATION_EMOJIS = ['⭐', '✨', '🎉', '🎊', '💫', '🌟', '🏆'] as const;
