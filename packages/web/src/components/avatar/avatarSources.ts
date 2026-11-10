/**
 * Avatar sources: builtin hand-drawn portraits, generated avatars and the tinted wolf-paw
 * fallback. Ported from the RN client's `utils/avatar.ts` and `utils/defaultAvatarIcons.ts`.
 */
import {
  HAND_DRAWN_AVATAR_IDS,
  type HandDrawnAvatarId,
} from '@game-judge/game-engine/product/rewards';

import wolfPawUrl from '../../../../../assets/avatars/seat/wolf-paw.png';
import { isGeneratedAvatar } from './GeneratedAvatar';

const portraitFiles = import.meta.glob<string>('../../../../../assets/avatars/web/*.webp', {
  eager: true,
  import: 'default',
});

/** Hand-drawn portrait URL by avatar id; every catalog id must have a file. */
const PORTRAIT_URLS: ReadonlyMap<string, string> = (() => {
  const byName = new Map<string, string>();
  for (const [path, url] of Object.entries(portraitFiles)) {
    byName.set(path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url);
  }
  for (const id of HAND_DRAWN_AVATAR_IDS) {
    if (!byName.has(id)) throw new Error(`Missing portrait assets/avatars/web/${id}.webp`);
  }
  return byName;
})();

/** The hand-drawn portrait URL of one catalog avatar id. */
export function getHandDrawnPortraitUrl(id: HandDrawnAvatarId): string {
  const url = PORTRAIT_URLS.get(id);
  if (url === undefined) throw new Error(`Missing portrait for ${id}`);
  return url;
}

/** Hand-drawn portrait URLs in catalog order. */
export const HAND_DRAWN_PORTRAITS: readonly string[] =
  HAND_DRAWN_AVATAR_IDS.map(getHandDrawnPortraitUrl);

const BUILTIN_AVATAR_PREFIX = 'builtin://';

/** The stored avatar URL of a builtin (hand-drawn or generated) catalog avatar. */
export function makeBuiltinAvatarUrl(avatarId: string): string {
  return `${BUILTIN_AVATAR_PREFIX}${avatarId}`;
}

/** The catalog avatar id of a builtin avatar URL; null for an upload or no avatar. */
export function parseBuiltinAvatarId(avatarUrl: string | null): string | null {
  if (avatarUrl === null || !avatarUrl.startsWith(BUILTIN_AVATAR_PREFIX)) return null;
  return avatarUrl.slice(BUILTIN_AVATAR_PREFIX.length);
}

/** Tint palette for the wolf-paw fallback; 20 colours keep 12-player rooms distinct. */
const FALLBACK_TINTS: readonly string[] = [
  '#C0392B',
  '#E67E22',
  '#D4AC0D',
  '#27AE60',
  '#16A085',
  '#2980B9',
  '#8E44AD',
  '#E84393',
  '#2C3E50',
  '#D35400',
  '#1ABC9C',
  '#6C5CE7',
  '#A04000',
  '#1F618D',
  '#7D3C98',
  '#196F3D',
  '#CB4335',
  '#5B2C6F',
  '#1A5276',
  '#B7950B',
];

/** FNV-1a: good avalanche for short similar strings such as "bot-0" … "bot-11". */
function fnv1aHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fallbackTint(userId: string): string {
  const tint = FALLBACK_TINTS[fnv1aHash(userId) % FALLBACK_TINTS.length];
  if (tint === undefined) throw new Error('Fallback tint palette is empty');
  return tint;
}

/** How an avatar renders. */
export type AvatarSource =
  | { kind: 'image'; url: string }
  | { kind: 'generated'; seed: string }
  | { kind: 'fallback'; maskUrl: string; tint: string };

/**
 * Resolves what to render for a user: an uploaded image, a builtin portrait or generated avatar
 * (`builtin://<id>`), or the wolf paw tinted deterministically from `userId`.
 */
export function resolveAvatarSource(userId: string, avatarUrl: string | null): AvatarSource {
  if (avatarUrl !== null && !avatarUrl.startsWith(BUILTIN_AVATAR_PREFIX)) {
    return { kind: 'image', url: avatarUrl };
  }
  if (avatarUrl !== null) {
    const id = avatarUrl.slice(BUILTIN_AVATAR_PREFIX.length);
    if (isGeneratedAvatar(id)) return { kind: 'generated', seed: id };
    const portrait = PORTRAIT_URLS.get(id);
    if (portrait !== undefined) return { kind: 'image', url: portrait };
  }
  return { kind: 'fallback', maskUrl: wolfPawUrl, tint: fallbackTint(userId) };
}
