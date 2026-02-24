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
interface AlignmentTheme {
  /** Primary color */
  primaryColor: string;
  /** Secondary/glow color */
  glowColor: string;
  /** Particle color */
  particleColor: string;
  /** Background gradient colors */
  gradientColors: [string, string];
}

/**
 * Build AlignmentTheme for a single primary color.
 * Derives glow (lighten 35%), particle (lighten 55%), gradient (darken 75% / 55%).
 */
function buildAlignmentTheme(primary: string): AlignmentTheme {
  return {
    primaryColor: primary,
    glowColor: lighten(primary, 0.35),
    particleColor: lighten(primary, 0.55),
    gradientColors: [darken(primary, 0.75), darken(primary, 0.55)],
  };
}

/**
 * Create 4-faction alignment themes from current ThemeColors.
 * Consumers should memoize the result via `useMemo(() => createAlignmentThemes(colors), [colors])`.
 */
export function createAlignmentThemes(colors: ThemeColors): Record<RoleAlignment, AlignmentTheme> {
  return {
    wolf: buildAlignmentTheme(colors.wolf),
    god: buildAlignmentTheme(colors.god),
    villager: buildAlignmentTheme(colors.villager),
    third: buildAlignmentTheme(colors.third),
  };
}
