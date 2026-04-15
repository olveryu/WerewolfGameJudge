/**
 * tokens - Design Tokens (Semantic Design System)
 *
 * 三层架构:
 * 1. Primitives (内部) - 基础数值
 * 2. Semantic (公开 API) - 语义化命名
 * 3. Component (公开 API) - 组件专用尺寸
 *
 * 导出 spacing / typography / borderRadius / shadows / layout / componentSizes 定义。
 *
 * 使用方式:
 * - import { spacing, typography, borderRadius, componentSizes } from '@/theme/tokens';
 * - spacing.small, typography.body, borderRadius.medium
 *
 * 不包含业务逻辑，不引入 React 或 service。颜色值统一在 themes.ts 中定义，此处禁止硬编码颜色。
 */

import { Dimensions, PixelRatio, Platform, TextStyle, ViewStyle } from 'react-native';

// ============================================================================
// Responsive Scaling
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375; // iPhone SE/8 基准宽度

/**
 * 响应式缩放因子 (0.75x ~ 1.25x)
 * - 小屏 (320px): 0.85x
 * - 基准 (375px): 1.0x
 * - 大屏 (428px+): 1.14x ~ 1.25x
 */
const getScaleFactor = (): number => {
  const raw = SCREEN_WIDTH / BASE_WIDTH;
  return Math.max(0.75, Math.min(1.25, raw));
};

const SCALE = getScaleFactor();

/**
 * 应用响应式缩放
 * @param size 基础尺寸
 * @returns 缩放后的尺寸 (像素对齐)
 */
const scale = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * SCALE);
};

// ============================================================================
// Layer 1: Primitives (内部使用)
// ============================================================================

/** 基础间距值 */
const primitiveSpace = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 12,
  6: 16,
  7: 20,
  8: 24,
  9: 32,
  10: 40,
  11: 48,
  12: 64,
} as const;

/** 基础字号值 */
const primitiveFontSize = {
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  17: 17,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  28: 28,
  32: 32,
  36: 36,
  40: 40,
  48: 48,
} as const;

/** 基础圆角值 */
const primitiveRadius = {
  0: 0,
  4: 4,
  6: 6,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  9999: 9999,
} as const;

/** 基础尺寸值 */
const primitiveSize = {
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  36: 36,
  40: 40,
  44: 44,
  48: 48,
  56: 56,
  64: 64,
  72: 72,
  80: 80,
  96: 96,
  120: 120,
} as const;

// ============================================================================
// Layer 2: Semantic Tokens (公开 API)
// ============================================================================

/**
 * 语义化间距
 * - tight: 紧凑间距 (图标与文字)
 * - small: 小间距 (列表项内部)
 * - medium: 中等间距 (卡片内边距)
 * - large: 大间距 (区块分隔)
 * - xlarge: 超大间距 (页面边距)
 * - xxlarge: 特大间距 (大区块分隔)
 */
export const spacing = {
  /** 2px - 微间距（紧凑复合控件内部） */
  micro: scale(primitiveSpace[1]),
  /** 4px - 紧凑间距 */
  tight: scale(primitiveSpace[2]),
  /** 8px - 小间距 */
  small: scale(primitiveSpace[4]),
  /** 16px - 中等间距 */
  medium: scale(primitiveSpace[6]),
  /** 24px - 大间距 */
  large: scale(primitiveSpace[8]),
  /** 32px - 超大间距 */
  xlarge: scale(primitiveSpace[9]),
  /** 48px - 特大间距 */
  xxlarge: scale(primitiveSpace[11]),
  /** 20px - 屏幕水平边距（区别于卡片内距 medium=16） */
  screenH: scale(primitiveSpace[7]),
} as const;

/**
 * 语义化字号
 * - captionSmall: 极小辅助
 * - caption: 辅助说明文字
 * - secondary: 次要信息
 * - body: 正文
 * - subtitle: 副标题
 * - title: 标题
 * - heading: 大标题
 * - hero: 超大标题
 * - display: 展示标题
 */
export const typography = {
  /** 10px - 极小辅助 */
  captionSmall: scale(primitiveFontSize[10]),
  /** 12px - 辅助说明 */
  caption: scale(primitiveFontSize[12]),
  /** 14px - 次要信息 */
  secondary: scale(primitiveFontSize[14]),
  /** 16px - 正文 */
  body: scale(primitiveFontSize[16]),
  /** 18px - 副标题 */
  subtitle: scale(primitiveFontSize[18]),
  /** 20px - 标题 */
  title: scale(primitiveFontSize[20]),
  /** 24px - 大标题 */
  heading: scale(primitiveFontSize[24]),
  /** 32px - 超大标题 */
  hero: scale(primitiveFontSize[32]),
  /** 40px - 展示标题 */
  display: scale(primitiveFontSize[40]),

  /** 字重 */
  weights: {
    normal: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
  },

  /** 行高（与字号语义层一一对应） */
  lineHeights: {
    captionSmall: scale(14),
    caption: scale(16),
    secondary: scale(20),
    body: scale(24),
    subtitle: scale(26),
    title: scale(28),
    heading: scale(34),
    hero: scale(42),
    display: scale(50),
  },

  /** 字间距 */
  letterSpacing: {
    /** 大标题收紧 */
    tight: -0.5,
    /** 正文 */
    normal: 0,
    /** caption / button label 展开 */
    wide: 0.5,
    /** display / hero 收紧 */
    hero: -1,
  },
} as const;

/**
 * 语义化圆角
 * - none: 无圆角
 * - small: 小圆角 (按钮、输入框)
 * - medium: 中等圆角 (卡片)
 * - large: 大圆角 (弹窗、底部面板)
 * - xlarge: 超大圆角
 * - full: 完全圆角 (头像、徽章)
 */
export const borderRadius = {
  /** 0px */
  none: primitiveRadius[0],
  /** 10px — 按钮、输入框 */
  small: scale(10),
  /** 14px — 标签、小卡片 */
  medium: scale(14),
  /** 20px — 内容卡片、弹窗 */
  large: scale(20),
  /** 28px — Hero 卡片、底部面板 */
  xlarge: scale(28),
  /** 9999px */
  full: primitiveRadius[9999],
} as const;

// ============================================================================
// Layer 3: Component Tokens (公开 API)
// ============================================================================

/**
 * 组件尺寸
 */
export const componentSizes = {
  /** 按钮高度 */
  button: {
    sm: scale(primitiveSize[32]),
    md: scale(primitiveSize[44]),
    lg: scale(primitiveSize[56]),
  },

  /** 头像尺寸 */
  avatar: {
    xs: scale(primitiveSize[24]),
    sm: scale(primitiveSize[32]),
    md: scale(primitiveSize[40]),
    lg: scale(primitiveSize[56]),
    xl: scale(primitiveSize[80]),
  },

  /** 图标尺寸 */
  icon: {
    xs: scale(primitiveSize[12]),
    sm: scale(primitiveSize[16]),
    md: scale(primitiveSize[20]),
    lg: scale(primitiveSize[24]),
    xl: scale(primitiveSize[32]),
  },

  /** 徽章尺寸 */
  badge: {
    dot: scale(8),
    sm: scale(primitiveSize[16]),
    md: scale(primitiveSize[20]),
  },

  /** 标签/Chip */
  chip: {
    minWidth: scale(primitiveSize[56]),
    paddingH: scale(primitiveSpace[5]),
    paddingV: scale(primitiveSpace[3]),
  },

  /** 拖拽手柄（Bottom Sheet） */
  handle: {
    width: scale(primitiveSize[36]),
    height: scale(4),
  },

  /** 单选按钮 */
  radio: {
    size: scale(primitiveSize[20]),
    dotSize: scale(10),
  },

  /** 进度条 */
  progressBar: {
    height: 2,
    borderRadius: 1,
  },

  /** 模态框 */
  modal: {
    /** 居中弹窗最小宽度（~280px 基准） */
    minWidth: scale(280),
  },

  /** 弹出菜单 */
  menu: {
    minWidth: scale(180),
    compactMinWidth: scale(140),
  },

  /** 头部操作区（左/右按钮组） */
  headerAction: {
    minWidth: scale(60),
  },

  /** 头部导航栏 */
  header: scale(primitiveSize[56]),

  /** 底部标签栏 */
  tabBar: scale(primitiveSize[56]),
} as const;

// ============================================================================
// Text Style Presets (结构性：fontSize + lineHeight + fontWeight，不含 color)
// ============================================================================

/**
 * 预组合文字样式 — 仅包含结构属性（fontSize / lineHeight / fontWeight）。
 *
 * 使用时展开并追加 color：`{ ...textStyles.body, color: colors.text }`
 * 消除 fontSize + lineHeight 配对不一致的风险。
 */
export const textStyles = {
  caption: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  captionSmall: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
  },
  secondary: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  secondarySemibold: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
  },
  body: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  bodyMedium: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
  },
  bodySemibold: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
  subtitle: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
  },
  subtitleSemibold: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.semibold,
  },
  title: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
  },
  titleBold: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
  },
  heading: {
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
  },
  headingBold: {
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
} as const;

// ============================================================================
// Fixed Values (不响应式缩放)
// ============================================================================

/**
 * 固定值 - 不随屏幕缩放
 */
export const fixed = {
  /** 边框宽度 */
  borderWidth: 1,
  borderWidthThick: 2,
  borderWidthHighlight: 3,

  /** 分隔线高度 */
  divider: 1,

  /** 最小点击区域 */
  minTouchTarget: 44,

  /** 最大内容宽度 */
  maxContentWidth: 600,

  /** 键盘避让额外间距 */
  keyboardOffset: 24,

  /** TouchableOpacity 按下态透明度 */
  activeOpacity: 0.7,

  /** 通用禁用态静态 opacity */
  disabledOpacity: 0.5,
} as const;

// ============================================================================
// Shadows
// ============================================================================

/**
 * 跨平台 textShadow 生成器
 * - iOS/Android: textShadowColor / textShadowOffset / textShadowRadius
 * - Web: textShadow (string shorthand)
 */
export function crossPlatformTextShadow(
  color: string,
  offsetX: number,
  offsetY: number,
  blurRadius: number,
): TextStyle {
  return Platform.select({
    web: { textShadow: `${offsetX}px ${offsetY}px ${blurRadius}px ${color}` },
    default: {
      textShadowColor: color,
      textShadowOffset: { width: offsetX, height: offsetY },
      textShadowRadius: blurRadius,
    },
  }) as TextStyle;
}

/**
 * 阴影样式 (跨平台)
 *
 * RN 0.76+ New Architecture: boxShadow 直接跨 iOS / Android / Web。
 */
export const shadows = {
  none: {} as ViewStyle,
  sm: { boxShadow: '0px 2px 8px rgba(108,92,231,0.10)' } as ViewStyle,
  md: { boxShadow: '0px 4px 16px rgba(108,92,231,0.13)' } as ViewStyle,
  lg: { boxShadow: '0px 8px 32px rgba(108,92,231,0.18)' } as ViewStyle,
  /** Upward shadow for bottom panels */
  upward: { boxShadow: '0px -4px 16px rgba(108,92,231,0.13)' } as ViewStyle,
  /** Strong upward shadow for primary bottom action panels */
  lgUpward: { boxShadow: '0px -8px 24px rgba(108,92,231,0.18)' } as ViewStyle,
} as const;

// ============================================================================
// Layout Constants
// ============================================================================

/**
 * 布局常量
 */
export const layout = {
  /** 最大内容宽度 */
  maxWidth: fixed.maxContentWidth,
  /** 头部高度 */
  headerHeight: componentSizes.header,
  /** 标签栏高度 */
  tabBarHeight: componentSizes.tabBar,
  /** 屏幕水平内边距 */
  screenPaddingH: spacing.screenH,
  /** 屏幕 header 垂直内边距 */
  headerPaddingV: spacing.medium,
  /** 屏幕 header 标题字号 */
  headerTitleSize: typography.title,
  /** 屏幕 header 标题行高 */
  headerTitleLineHeight: typography.lineHeights.title,
  /** 屏幕垂直内边距 */
  screenPaddingV: spacing.large,
  /** 卡片内边距 */
  cardPadding: spacing.medium,
  /** 列表项间距 */
  listItemGap: spacing.small,
} as const;
