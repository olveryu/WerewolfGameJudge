/**
 * IconTokens — Ionicons 语义 Token 集中定义
 *
 * 所有 UI 层图标的唯一来源（从 emojiTokens.ts 迁移而来）。
 * 一义一图、禁止跨语义复用。不含业务逻辑 / 副作用 / 运行时依赖。
 *
 * 角色 emoji 仍由 specs.ts 定义；夜间行动前缀 / 庆典粒子仍在 emojiTokens.ts。
 */
import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconsName = ComponentProps<typeof Ionicons>['name'];

// ── Game / system status ─────────────────────────────────────

export const STATUS_ICONS = {
  READY: 'checkmark-circle',
  WARNING: 'warning-outline',
  ERROR: 'alert-circle',
  PEACEFUL_NIGHT: 'moon-outline',
  DEATH: 'skull-outline',
  SPEAKING: 'mic-outline',
} as const satisfies Record<string, IoniconsName>;

// ── Generic UI icons ─────────────────────────────────────────

export const UI_ICONS = {
  HINT: 'bulb-outline',
  EDIT: 'create-outline',
  NOTE: 'document-text-outline',
  DELETE: 'trash-outline',
  CAMERA: 'camera-outline',
  EMAIL: 'mail-outline',
  SHARE: 'share-outline',
  THEME: 'color-palette-outline',
  USER: 'person-outline',
  BOT: 'chatbubble-ellipses-outline',
  GAMEPAD: 'game-controller-outline',
  AUDIO: 'volume-high-outline',
  GREETING: 'hand-left-outline',
  RECORD: 'clipboard-outline',
  ROLE_PLACEHOLDER: 'help-circle-outline',
} as const satisfies Record<string, IoniconsName>;
