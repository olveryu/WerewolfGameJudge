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
 *       padding: t.spacing.md, // or spacing.md
 *       borderRadius: t.borderRadius.md,
 *     }}>
 *       <Text style={{ color: colors.text, fontSize: t.typography.base }}>
 *         Hello
 *       </Text>
 *     </View>
 *   );
 * }
 */

// Provider & Hooks
export {
  ThemeProvider,
  useTheme,
  useColors,
  useTokens,
} from './ThemeProvider';

// Tokens (可直接导入)
export {
  spacing,
  borderRadius,
  typography,
  shadows,
  layout,
} from './tokens';

// Types & Themes
export {
  themes,
  defaultTheme,
  type ThemeKey,
  type ThemeColors,
  type Theme,
} from './themes';
