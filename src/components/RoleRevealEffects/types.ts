/**
 * RoleRevealEffects/types - 揭示动画共享类型
 *
 * 所有揭示动画组件的公共接口定义。
 *
 * ✅ 允许：纯类型/接口/枚举定义
 * ❌ 禁止：运行时逻辑 / import service
 */

/**
 * Role alignment/faction for visual theming
 */
export type RoleAlignment = 'wolf' | 'god' | 'villager';

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
  | 'flip'
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
}

/**
 * Alignment theme configurations
 */
export const ALIGNMENT_THEMES: Record<RoleAlignment, AlignmentTheme> = {
  wolf: {
    primaryColor: '#DC2626',
    glowColor: '#FF4444',
    particleColor: '#FF6B6B',
    gradientColors: ['#450A0A', '#7F1D1D'],
  },
  god: {
    primaryColor: '#3B82F6',
    glowColor: '#60A5FA',
    particleColor: '#93C5FD',
    gradientColors: ['#1E3A5F', '#1E40AF'],
  },
  villager: {
    primaryColor: '#22C55E',
    glowColor: '#4ADE80',
    particleColor: '#86EFAC',
    gradientColors: ['#14532D', '#166534'],
  },
};
