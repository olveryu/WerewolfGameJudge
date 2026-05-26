/**
 * Theme System - design system entry point
 *
 * Usage example:
 *
 * import { colors, spacing, borderRadius } from '@/theme';
 *
 * function MyComponent() {
 *   return (
 *     <View style={{
 *       backgroundColor: colors.background,
 *       padding: spacing.medium,
 *       borderRadius: borderRadius.medium,
 *     }}>
 *       <Text style={{ color: colors.text, fontSize: typography.body }}>
 *         Hello
 *       </Text>
 *     </View>
 *   );
 * }
 */

// Colors
export { colors, type ThemeColors } from './colors';

// Tokens (importable directly)
export {
  borderRadius,
  componentSizes,
  crossPlatformTextShadow,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  typography,
} from './tokens';

// Color utilities
export { withAlpha } from './colorUtils';

// Shared style bases
export { createSharedStyles } from './sharedStyles';
