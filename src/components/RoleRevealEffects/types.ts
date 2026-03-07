/**
 * RoleRevealEffects/types - 揭示动画共享类型与阵营配色工厂
 *
 * 所有揭示动画组件的公共接口定义。
 * 导出类型、接口、枚举定义，以及 `createAlignmentThemes` 工厂函数
 * （基于 ThemeColors token 派生 glow / particle / gradient 色）。
 * 不 import service。
 */
import type { ThemeColors } from '@/theme';
import { darken, lighten } from '@/theme/colorUtils';

/**
 * Role alignment/faction for visual theming (4-faction)
 */
export type RoleAlignment = 'wolf' | 'god' | 'villager' | 'third';

/**
 * Role data passed to reveal effects
 */
export interface RoleData {
  /** Role identifier */
  id: string;
  /** Display name (Chinese) */
  name: string;
  /** Role alignment for visual theming */
  alignment: RoleAlignment;
  /** Avatar/icon (emoji or image URI) */
  avatar?: string;
  /** Optional description */
  description?: string;
}

/**
 * Available reveal effect types
 */
export type RevealEffectType =
  | 'roulette'
  | 'roleHunt'
  | 'scratch'
  | 'tarot'
  | 'gachaMachine'
  | 'cardPick';

/**
 * Common props for all reveal effect components
 */
export interface RoleRevealEffectProps {
  /** Role to reveal */
  role: RoleData;
  /** Callback when reveal animation completes */
  onComplete: () => void;
  /** Respect system "reduce motion" preference */
  reducedMotion?: boolean;
  /** Enable haptic feedback (mobile only) */
  enableHaptics?: boolean;
  /** Optional test ID prefix */
  testIDPrefix?: string;
}

/**
 * Props for the unified RoleRevealAnimator component
 */
export interface RoleRevealAnimatorProps extends RoleRevealEffectProps {
  /** Effect type to use */
  effectType: RevealEffectType;
  /** Whether the reveal is visible */
  visible: boolean;
  /** For roulette effect: list of all roles to scroll through */
  allRoles?: RoleData[];
  /** For cardPick effect: number of remaining (unviewed) cards on the table */
  remainingCards?: number;
}

/**
 * Configuration for alignment-based visual theming
 */
export interface AlignmentTheme {
  /** Primary color */
  primaryColor: string;
  /** Secondary/glow color */
  glowColor: string;
  /** Particle color */
  particleColor: string;
  /** Background gradient colors */
  gradientColors: [string, string];
  /**
   * Reveal-mode card background gradient (3-stop: edge-center-edge).
   * Matches HTML demo v2 `linear-gradient(160deg, dark, slightly-lighter, dark)` pattern.
   * Derived from primaryColor via darken.
   */
  revealGradient: readonly [string, string, string];
}

/**
 * Build AlignmentTheme for a single primary color.
 * Derives glow (lighten 35%), particle (lighten 55%), gradient (darken 75% / 55%),
 * revealGradient (3-stop: darken 75%, 58%, 75%).
 *
 * HTML demo v2 uses luminance ~3-5% (darken 92%/85%), which only works against
 * the demo's pure-black (#0a0a0a) page background. In-app the surrounding UI is
 * lighter, so we use less extreme values to keep the faction tint clearly visible.
 */
function buildAlignmentTheme(primary: string): AlignmentTheme {
  const edge = darken(primary, 0.75);
  const center = darken(primary, 0.58);
  return {
    primaryColor: primary,
    glowColor: lighten(primary, 0.35),
    particleColor: lighten(primary, 0.55),
    gradientColors: [darken(primary, 0.75), darken(primary, 0.55)],
    revealGradient: [edge, center, edge] as const,
  };
}

/**
 * Neutral grey theme for villager, matching HTML demo v2 card-normal style.
 * Demo: background linear-gradient(160deg, #1e2230, #2a3040, #1e2230),
 * border #444, normalReveal glow rgba(150,150,180, 0.2).
 */
const VILLAGER_THEME: AlignmentTheme = {
  primaryColor: '#9696B4',
  glowColor: '#B0B0C8',
  particleColor: '#CCCCDD',
  gradientColors: ['#1e2230', '#2a3040'],
  revealGradient: ['#1e2230', '#2a3040', '#1e2230'] as const,
};

/**
 * Create 4-faction alignment themes from current ThemeColors.
 * Consumers should memoize the result via `useMemo(() => createAlignmentThemes(colors), [colors])`.
 * Villager uses a fixed neutral grey theme matching HTML demo card-normal style.
 */
export function createAlignmentThemes(colors: ThemeColors): Record<RoleAlignment, AlignmentTheme> {
  return {
    wolf: buildAlignmentTheme(colors.wolf),
    god: buildAlignmentTheme(colors.god),
    villager: VILLAGER_THEME,
    third: buildAlignmentTheme(colors.third),
  };
}
