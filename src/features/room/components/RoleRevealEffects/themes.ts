/**
 * RoleRevealEffects/themes - 阵营视觉主题（游戏无关）。
 *
 * 从狼人杀 types.ts 提取，`RoleAlignment` 改为 `RevealAlignment`。
 * 基于 ThemeColors tokens 派生辉光/粒子/渐变色。
 */
import type { ThemeColors } from '@/theme';
import { darken, lighten } from '@/theme/colorUtils';

import type { RevealAlignment } from '../../model/RevealRoleData';

/**
 * 阵营视觉主题配置
 */
export interface AlignmentTheme {
  /** 主色 */
  readonly primaryColor: string;
  /** 辉光色 */
  readonly glowColor: string;
  /** 粒子色 */
  readonly particleColor: string;
  /** 背景渐变色 */
  readonly gradientColors: [string, string];
  /**
   * 揭示模式卡牌背景渐变（三段：边缘-中心-边缘）。
   */
  readonly revealGradient: readonly [string, string, string];
}

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

const VILLAGER_THEME: AlignmentTheme = {
  primaryColor: '#9696B4',
  glowColor: '#B0B0C8',
  particleColor: '#CCCCDD',
  gradientColors: ['#1e2230', '#2a3040'],
  revealGradient: ['#1e2230', '#2a3040', '#1e2230'] as const,
};

/**
 * 从 ThemeColors 创建四阵营主题。
 * 调用方应用 useMemo 缓存结果。
 */
export function createAlignmentThemes(
  colors: ThemeColors,
): Record<RevealAlignment, AlignmentTheme> {
  return {
    wolf: buildAlignmentTheme(colors.wolf),
    god: buildAlignmentTheme(colors.god),
    villager: VILLAGER_THEME,
    third: buildAlignmentTheme(colors.third),
    neutral: buildAlignmentTheme(colors.textSecondary),
  };
}
