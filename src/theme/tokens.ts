/**
 * tokens - Design Tokens (Semantic Design System)
 *
 * Three-layer architecture:
 * 1. Primitives (internal) - base values
 * 2. Semantic (public API) - semantic naming
 * 3. Component (public API) - component-specific sizes
 *
 * Exports spacing / typography / borderRadius / shadows / layout / componentSizes definitions.
 *
 * Usage:
 * - import { spacing, typography, borderRadius, componentSizes } from '@/theme/tokens';
 * - spacing.small, typography.body, borderRadius.medium
 *
 * No business logic, no React or service imports. Colors defined in themes.ts; hardcoding colors here is forbidden.
 */

import { Dimensions, PixelRatio, Platform, type TextStyle, type ViewStyle } from 'react-native';

// ============================================================================
// Responsive Scaling
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375; // iPhone SE/8 base width

/**
 * Responsive scale factor (0.75x ~ 1.25x)
 * - Small screen (320px): 0.85x
 * - Base (375px): 1.0x
 * - Large screen (428px+): 1.14x ~ 1.25x
 */
const getScaleFactor = (): number => {
  const raw = SCREEN_WIDTH / BASE_WIDTH;
  return Math.max(0.75, Math.min(1.25, raw));
};

const SCALE = getScaleFactor();

/**
 * Apply responsive scaling
 * @param size Base size
 * @returns Scaled size (pixel-aligned)
 */
const scale = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * SCALE);
};

// ============================================================================
// Layer 1: Primitives (internal use)
// ============================================================================

/** Base spacing values */
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

/** Base font size values */
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

/** Base border radius values */
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

/** Base size values */
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
// Layer 2: Semantic Tokens (public API)
// ============================================================================

/**
 * Semantic spacing
 * - tight: compact spacing (icon & text)
 * - small: small spacing (list item internal)
 * - medium: medium spacing (card padding)
 * - large: large spacing (section separation)
 * - xlarge: extra-large spacing (page margin)
 * - xxlarge: double-extra-large spacing (major section separation)
 */
export const spacing = {
  /** 2px - micro spacing (inside compact compound controls) */
  micro: scale(primitiveSpace[1]),
  /** 4px - tight spacing */
  tight: scale(primitiveSpace[2]),
  /** 8px - small spacing */
  small: scale(primitiveSpace[4]),
  /** 16px - medium spacing */
  medium: scale(primitiveSpace[6]),
  /** 24px - large spacing */
  large: scale(primitiveSpace[8]),
  /** 32px - extra-large spacing */
  xlarge: scale(primitiveSpace[9]),
  /** 48px - double-extra-large spacing */
  xxlarge: scale(primitiveSpace[11]),
  /** 20px - screen horizontal margin (distinct from card padding medium=16) */
  screenH: scale(primitiveSpace[7]),
} as const;

/**
 * Semantic font sizes
 * - captionSmall: extra-small auxiliary
 * - caption: auxiliary/description text
 * - secondary: secondary info
 * - body: body text
 * - subtitle: subtitle
 * - title: title
 * - heading: heading
 * - hero: hero title
 * - display: display title
 */
export const typography = {
  /** 10px - extra-small auxiliary */
  captionSmall: scale(primitiveFontSize[10]),
  /** 12px - auxiliary/caption */
  caption: scale(primitiveFontSize[12]),
  /** 14px - secondary info */
  secondary: scale(primitiveFontSize[14]),
  /** 16px - body */
  body: scale(primitiveFontSize[16]),
  /** 18px - subtitle */
  subtitle: scale(primitiveFontSize[18]),
  /** 20px - title */
  title: scale(primitiveFontSize[20]),
  /** 24px - heading */
  heading: scale(primitiveFontSize[24]),
  /** 32px - hero title */
  hero: scale(primitiveFontSize[32]),
  /** 40px - display title */
  display: scale(primitiveFontSize[40]),

  /** Font weight */
  weights: {
    normal: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
  },

  /** Line height (1:1 mapping with font size semantic layer) */
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

  /** Letter spacing */
  letterSpacing: {
    /** Heading tightened */
    tight: -0.5,
    /** Body */
    normal: 0,
    /** caption / button label expanded */
    wide: 0.5,
    /** display / hero tightened */
    hero: -1,
  },
} as const;

/**
 * Semantic border radius
 * - none: no rounding
 * - small: small radius (buttons, inputs)
 * - medium: medium radius (cards)
 * - large: large radius (modals, bottom panels)
 * - xlarge: extra-large radius
 * - full: fully rounded (avatars, badges)
 */
export const borderRadius = {
  /** 0px */
  none: primitiveRadius[0],
  /** 10px — buttons, inputs */
  small: scale(10),
  /** 14px — tags, small cards */
  medium: scale(14),
  /** 20px — content cards, modals */
  large: scale(20),
  /** 28px — Hero cards, bottom panels */
  xlarge: scale(28),
  /** 9999px */
  full: primitiveRadius[9999],
} as const;

// ============================================================================
// Layer 3: Component Tokens (public API)
// ============================================================================

/**
 * Component sizes
 */
export const componentSizes = {
  /** Button height */
  button: {
    sm: scale(primitiveSize[32]),
    md: scale(primitiveSize[44]),
    lg: scale(primitiveSize[56]),
  },

  /** Avatar sizes */
  avatar: {
    xs: scale(primitiveSize[24]),
    sm: scale(primitiveSize[32]),
    md: scale(primitiveSize[40]),
    lg: scale(primitiveSize[56]),
    xl: scale(primitiveSize[80]),
  },

  /** Icon sizes */
  icon: {
    xs: scale(primitiveSize[12]),
    sm: scale(primitiveSize[16]),
    md: scale(primitiveSize[20]),
    lg: scale(primitiveSize[24]),
    xl: scale(primitiveSize[32]),
  },

  /** Badge sizes */
  badge: {
    dot: scale(8),
    sm: scale(primitiveSize[16]),
    md: scale(primitiveSize[20]),
    lg: scale(primitiveSize[24]),
  },

  /** Tag/Chip */
  chip: {
    minWidth: scale(primitiveSize[56]),
    paddingH: scale(primitiveSpace[5]),
    paddingV: scale(primitiveSpace[3]),
  },

  /** Drag handle (Bottom Sheet) */
  handle: {
    width: scale(primitiveSize[36]),
    height: scale(4),
  },

  /** Radio button */
  radio: {
    size: scale(primitiveSize[20]),
    dotSize: scale(10),
  },

  /** Progress bar */
  progressBar: {
    height: 2,
    borderRadius: 1,
  },

  /** Modal */
  modal: {
    /** Centered modal minimum width (~280px base) */
    minWidth: scale(280),
  },

  /** Popup menu */
  menu: {
    minWidth: scale(180),
    compactMinWidth: scale(140),
  },

  /** Header action area (left/right button groups) */
  headerAction: {
    minWidth: scale(60),
  },

  /** Header navigation bar */
  header: scale(primitiveSize[56]),

  /** Bottom tab bar */
  tabBar: scale(primitiveSize[56]),
} as const;

// ============================================================================
// Text Style Presets (structural: fontSize + lineHeight + fontWeight, no color)
// ============================================================================

/**
 * Pre-composed text styles — structural properties only (fontSize / lineHeight / fontWeight).
 *
 * Spread and append color when using: `{ ...textStyles.body, color: colors.text }`
 * Eliminates risk of mismatched fontSize + lineHeight pairs.
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
// Fixed Values (not responsive-scaled)
// ============================================================================

/**
 * Fixed values - not scaled with screen size
 */
export const fixed = {
  /** Border width */
  borderWidth: 1,
  borderWidthThick: 2,
  borderWidthHighlight: 3,

  /** Separator height */
  divider: 1,

  /** Minimum tap area */
  minTouchTarget: 44,

  /** Maximum content width */
  maxContentWidth: 600,

  /** Keyboard avoidance extra spacing */
  keyboardOffset: 24,

  /** TouchableOpacity pressed opacity */
  activeOpacity: 0.7,

  /** Generic disabled state opacity */
  disabledOpacity: 0.5,
} as const;

// ============================================================================
// Shadows
// ============================================================================

/**
 * Cross-platform textShadow generator
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
 * Shadow styles (cross-platform)
 *
 * RN 0.76+ New Architecture: boxShadow works directly across iOS / Android / Web.
 */
export const shadows = {
  none: {} as ViewStyle,
  sm: { boxShadow: '0px 1px 3px rgba(0,0,0,0.06)' } as ViewStyle,
  md: { boxShadow: '0px 2px 8px rgba(0,0,0,0.08)' } as ViewStyle,
  lg: { boxShadow: '0px 4px 16px rgba(0,0,0,0.10)' } as ViewStyle,
  /** Upward shadow for bottom panels */
  upward: { boxShadow: '0px -1px 8px rgba(0,0,0,0.06)' } as ViewStyle,
  /** Strong upward shadow for primary bottom action panels */
  lgUpward: { boxShadow: '0px -2px 12px rgba(0,0,0,0.08)' } as ViewStyle,
} as const;

// ============================================================================
// Layout Constants
// ============================================================================

/**
 * Layout constants
 */
export const layout = {
  /** Maximum content width */
  maxWidth: fixed.maxContentWidth,
  /** Header height */
  headerHeight: componentSizes.header,
  /** Tab bar height */
  tabBarHeight: componentSizes.tabBar,
  /** Screen horizontal padding */
  screenPaddingH: spacing.screenH,
  /** Screen header vertical padding */
  headerPaddingV: spacing.medium,
  /** Screen header title font size */
  headerTitleSize: typography.title,
  /** Screen header title line height */
  headerTitleLineHeight: typography.lineHeights.title,
  /** Screen vertical padding */
  screenPaddingV: spacing.large,
  /** Card padding */
  cardPadding: spacing.medium,
  /** List item gap */
  listItemGap: spacing.small,
} as const;
