/**
 * The gacha surfaces' own colours (the golden ticket and the machine's indigo), published as
 * `--gacha-*` custom properties on each gacha root (the page and every dialog, which portal out of
 * the page) so the CSS reads variables instead of colour literals.
 */
import type { CSSProperties } from 'react';

import { colors } from '@/theme/colors';
import { withAlpha } from '@/theme/colorUtils';

/** Golden ticket count and deep gold text. */
const GACHA_GOLD_DEEP = '#B8860B';
/** Golden ticket accent (icons, pity fill). */
const GACHA_GOLD = '#DAA520';
/** Golden accent near pity and the golden button border. */
const GACHA_GOLD_BRIGHT = '#FFD700';
/** Normal ticket accent. */
const GACHA_NORMAL_TINT = '#6366F1';

/** Inline style for a gacha root element. */
export const GACHA_PALETTE_VARS: CSSProperties = {
  '--gacha-gold': GACHA_GOLD,
  '--gacha-gold-deep': GACHA_GOLD_DEEP,
  '--gacha-gold-bright': GACHA_GOLD_BRIGHT,
  '--gacha-gold-a15': withAlpha(GACHA_GOLD, 0.15),
  '--gacha-gold-deep-a10': withAlpha(GACHA_GOLD_DEEP, 0.1),
  '--gacha-gold-deep-a50': withAlpha(GACHA_GOLD_DEEP, 0.5),
  '--gacha-gold-bright-a40': withAlpha(GACHA_GOLD_BRIGHT, 0.4),
  '--gacha-normal-tint': GACHA_NORMAL_TINT,
  '--gacha-normal-tint-a12': withAlpha(GACHA_NORMAL_TINT, 0.12),
  '--gacha-normal-tint-a20': withAlpha(GACHA_NORMAL_TINT, 0.2),
  '--gacha-draw-normal': `linear-gradient(135deg, #5B52ED, ${colors.primary}, #3730A3)`,
  '--gacha-draw-golden': `linear-gradient(135deg, #D4A517, ${GACHA_GOLD}, ${GACHA_GOLD_DEEP})`,
  '--gacha-surface-a12': withAlpha(colors.surface, 0.12),
  '--gacha-surface-a20': withAlpha(colors.surface, 0.2),
  '--gacha-text-a4': withAlpha(colors.text, 0.04),
  '--gacha-text-a6': withAlpha(colors.text, 0.06),
  '--gacha-warning-a8': withAlpha(colors.warning, 0.08),
};
