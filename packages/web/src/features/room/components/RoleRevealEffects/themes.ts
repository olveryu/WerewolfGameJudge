/** Per-faction reveal palettes, derived from the faction colors as in the React Native client. */
import { colors } from '@/theme/colors';
import { darken, lighten } from '@/theme/colorUtils';

import type { RevealAlignment } from '../../model/RevealRoleData';

export interface AlignmentTheme {
  readonly primaryColor: string;
  readonly glowColor: string;
  readonly particleColor: string;
  readonly gradientColors: readonly [string, string];
  readonly revealGradient: readonly [string, string, string];
}

function buildAlignmentTheme(primary: string): AlignmentTheme {
  const edge = darken(primary, 0.75);
  return {
    primaryColor: primary,
    glowColor: lighten(primary, 0.35),
    particleColor: lighten(primary, 0.55),
    gradientColors: [darken(primary, 0.75), darken(primary, 0.55)],
    revealGradient: [edge, darken(primary, 0.58), edge],
  };
}

/** Villagers use a fixed silver-blue palette instead of their green faction color. */
const VILLAGER_THEME: AlignmentTheme = {
  primaryColor: '#9696B4',
  glowColor: '#B0B0C8',
  particleColor: '#CCCCDD',
  gradientColors: ['#1E2230', '#2A3040'],
  revealGradient: ['#1E2230', '#2A3040', '#1E2230'],
};

export const ALIGNMENT_THEMES: Readonly<Record<RevealAlignment, AlignmentTheme>> = {
  wolf: buildAlignmentTheme(colors.wolf),
  god: buildAlignmentTheme(colors.god),
  villager: VILLAGER_THEME,
  third: buildAlignmentTheme(colors.third),
  neutral: buildAlignmentTheme(colors.textSecondary),
};

/** The faction color the card face uses for borders and the role name. */
export const ALIGNMENT_COLORS: Readonly<Record<RevealAlignment, string>> = {
  wolf: colors.wolf,
  god: colors.god,
  villager: colors.villager,
  third: colors.third,
  neutral: colors.textSecondary,
};
