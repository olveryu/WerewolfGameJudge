/** Strict local persistence for the Werewolf AI chat bubble position. */

import { storage } from '@/services/infra/localStorage';

const STORAGE_KEY_PREFIX = '@werewolf:ai-chat:bubble-position:';
const STORAGE_VERSION = 1;

export interface AIChatBubblePosition {
  readonly x: number;
  readonly y: number;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStorageKey(userId: string): string {
  if (userId.length === 0) throw new Error('AI chat bubble user ID must not be empty');
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

export function readAIChatBubblePosition(userId: string): AIChatBubblePosition | null {
  const raw = storage.getString(getStorageKey(userId));
  if (raw === undefined) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isJsonObject(parsed)) {
    throw new Error('Stored AI chat bubble position must be an object');
  }
  const keys = Object.keys(parsed).sort();
  if (keys.join(',') !== 'version,x,y') {
    throw new Error('Stored AI chat bubble position has unsupported fields');
  }
  const version = parsed.version;
  const x = parsed.x;
  const y = parsed.y;
  if (
    version !== STORAGE_VERSION ||
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y)
  ) {
    throw new Error('Stored AI chat bubble position must contain finite coordinates');
  }
  return { x, y };
}

export function writeAIChatBubblePosition(userId: string, position: AIChatBubblePosition): void {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new Error('AI chat bubble position must contain finite coordinates');
  }
  storage.set(
    getStorageKey(userId),
    JSON.stringify({ version: STORAGE_VERSION, x: position.x, y: position.y }),
  );
}
