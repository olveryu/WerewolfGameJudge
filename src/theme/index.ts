/**
 * Theme System - 设计系统入口
 *
 * 用法示例:
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

// Tokens (可直接导入)
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
