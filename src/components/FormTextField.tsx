/**
 * FormTextField — 通用文本输入组件
 *
 * 统一项目中表单字段和搜索栏的 TextInput 样式与行为。
 * 支持 ref 转发、两种变体（default 表单 / search 搜索栏）、错误展示、左侧图标。
 * 使用 theme tokens 构建样式，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, forwardRef, useMemo } from 'react';
import {
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  spacing,
  type ThemeColors,
  typography,
  useColors,
} from '@/theme';

// ── Types ────────────────────────────────────────────────

interface FormTextFieldProps extends Omit<TextInputProps, 'style'> {
  /** 变体：'default' = 有边框表单字段 | 'search' = 圆角搜索栏（含容器） */
  variant?: 'default' | 'search';
  /** 左侧图标（Ionicons name），search 变体渲染在容器内 */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** 错误信息（default 变体显示在输入框下方） */
  error?: string;
  /** 额外样式合并到 TextInput */
  style?: StyleProp<TextStyle>;
  /** 容器额外样式 */
  containerStyle?: StyleProp<ViewStyle>;
}

// ── Styles ───────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // default variant
    defaultInput: {
      height: spacing.xxlarge,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.medium,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.text,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      marginBottom: spacing.medium,
    },
    errorText: {
      color: colors.error,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      marginTop: -spacing.small,
      marginBottom: spacing.small,
    },
    // search variant
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
      padding: 0,
    },
  });
}

// ── Component ────────────────────────────────────────────

export const FormTextField = forwardRef<TextInput, FormTextFieldProps>(
  (
    { variant = 'default', icon, error, style, containerStyle, placeholderTextColor, ...rest },
    ref,
  ) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (variant === 'search') {
      return (
        <View style={[styles.searchBar, containerStyle]}>
          {icon != null && (
            <Ionicons name={icon} size={componentSizes.icon.sm} color={colors.textMuted} />
          )}
          <TextInput
            ref={ref}
            style={[styles.searchInput, style]}
            placeholderTextColor={placeholderTextColor ?? colors.textMuted}
            {...rest}
          />
        </View>
      );
    }

    // default variant
    return (
      <View style={containerStyle}>
        <TextInput
          ref={ref}
          style={[styles.defaultInput, style]}
          placeholderTextColor={placeholderTextColor ?? colors.textSecondary}
          {...rest}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  },
);

FormTextField.displayName = 'FormTextField';
