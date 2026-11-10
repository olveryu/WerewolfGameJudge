/**
 * The reveal's full-screen look: backdrop, title row and title text. RoleRevealAnimator renders
 * them inside its dialog; the scene bench renders them around the bare stage so its captures
 * match the room's reveal pixel for pixel.
 */
import type { CSSProperties } from 'react';

import type { RevealEffectType } from '../types';
import { REVEAL_DOM_LAYER } from './layers';

/** Effects that play without any interaction. */
const AUTO_EFFECTS: ReadonlySet<RevealEffectType> = new Set([
  'filmRewind',
  'fateDecree',
  'fateReweave',
  'oceanPearl',
  'unfoldLandscape',
]);

/** The title shown above `effectType`: a wait notice, or a prompt for interactive effects. */
export function revealTitle(effectType: RevealEffectType): string {
  return AUTO_EFFECTS.has(effectType) ? '🎭 你的身份即将揭晓' : '🎭 完成下方操作，揭晓你的身份';
}

export const REVEAL_ROOT_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  overflow: 'hidden',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  outline: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
};

export const REVEAL_TITLE_ROW_STYLE: CSSProperties = {
  position: 'absolute',
  top: 'calc(env(safe-area-inset-top) + 8px)',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  padding: '0 24px',
  zIndex: REVEAL_DOM_LAYER.title,
  pointerEvents: 'none',
};

export const REVEAL_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.92)',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  padding: '6px 16px',
  borderRadius: 12,
  textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)',
  letterSpacing: 2,
};
