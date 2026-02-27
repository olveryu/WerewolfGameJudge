/**
 * Theme System - 主题系统入口
 *
 * 用法示例:
 *
 * import { useTheme, useColors, spacing, borderRadius } from '@/theme';
 *
 * function MyComponent() {
 *   const { colors, t } = useTheme();
 *   // or
 *   const colors = useColors();
 *
 *   return (
 *     <View style={{
 *       backgroundColor: colors.background,
 *       padding: t.spacing.medium, // or spacing.medium
 *       borderRadius: t.borderRadius.medium,
 *     }}>
 *       <Text style={{ color: colors.text, fontSize: t.typography.body }}>
 *         Hello
 *       </Text>
 *     </View>
 *   );
 * }
 */

// Provider & Hooks
export { ThemeProvider, useColors, useTheme } from './ThemeProvider';

// Tokens (可直接导入)
export {
  borderRadius,
  crossPlatformTextShadow,
  fixed,
  layout,
  shadows,
  spacing,
  typography,
} from './tokens';

// Types & Themes
export { type ThemeColors, type ThemeKey } from './themes';
