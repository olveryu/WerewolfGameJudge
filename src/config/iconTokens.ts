/**
 * IconTokens — Ionicons semantic token definitions
 *
 * Single source of truth for all UI layer icons (migrated from emojiTokens.ts).
 * One icon per semantic meaning — cross-semantic reuse is forbidden. No business logic / side effects / runtime dependencies.
 *
 * Role emojis remain in specs.ts; night action prefixes / celebration particles remain in emojiTokens.ts.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

// ── Game / system status ─────────────────────────────────────
/** Game/system status icon map, used for seat status indicators and similar. */ export const STATUS_ICONS =
  {
    READY: 'checkmark-circle',
    WARNING: 'warning-outline',
    ERROR: 'alert-circle',
    PEACEFUL_NIGHT: 'moon-outline',
    DEATH: 'skull-outline',
    SPEAKING: 'mic-outline',
  } as const satisfies Record<string, IoniconsName>;

// ── Generic UI icons ─────────────────────────────────────────
/** General UI icon map, used for buttons / navigation / placeholders and similar. */ export const UI_ICONS =
  {
    CLOSE: 'close',
    HINT: 'bulb-outline',
    EDIT: 'create-outline',
    NOTE: 'document-text-outline',
    DELETE: 'trash-outline',
    CAMERA: 'camera-outline',
    EMAIL: 'mail-outline',
    SHARE: 'share-outline',
    USER: 'person-outline',
    BOT: 'chatbubble-ellipses-outline',
    GAMEPAD: 'game-controller-outline',
    AUDIO: 'volume-high-outline',
    GREETING: 'hand-left-outline',
    RECORD: 'clipboard-outline',
    ROLE_PLACEHOLDER: 'help-circle-outline',
    AI_ASSISTANT: 'sparkles-outline',
    INFO: 'information-circle-outline',
  } as const satisfies Record<string, IoniconsName>;

// ── Gacha icons ──────────────────────────────────────────────
/** Gacha system icon map. */ export const GACHA_ICONS = {
  NORMAL_DRAW: 'sparkles-outline',
  GOLDEN_DRAW: 'star',
} as const satisfies Record<string, IoniconsName>;
