/**
 * Button - 通用按钮组件
 *
 * 支持 primary/secondary/danger/outline 变体、三种尺寸、loading 状态。
 * Memoized 以避免不必要的重渲染。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent（onPress 回调）
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useMemo, memo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useColors, spacing, borderRadius, typography, ThemeColors } from '@/theme';

/** Metadata passed to onPress callback */
export interface ButtonPressMetadata {
  /** Whether the button was visually disabled when pressed */
  disabled: boolean;
  /** Whether the button was in loading state when pressed */
  loading: boolean;
}

interface ButtonProps {
  title: string;
  /**
   * Press handler. Receives metadata about button state.
   * Caller decides whether to proceed (e.g., ignore if disabled/loading).
   */
  onPress: (meta?: ButtonPressMetadata) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

const createStyles = (colors: ThemeColors) => ({
  variants: {
    primary: StyleSheet.create({
      button: { backgroundColor: colors.primary },
      text: { color: colors.textInverse },
    }),
    secondary: StyleSheet.create({
      button: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
      text: { color: colors.text },
    }),
    danger: StyleSheet.create({
      button: { backgroundColor: colors.error },
      text: { color: colors.textInverse },
    }),
    outline: StyleSheet.create({
      button: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: colors.primary,
      },
      text: { color: colors.primary },
    }),
  },
  base: StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.medium,
    },
    text: {
      fontWeight: typography.weights.semibold,
    },
    textWithIcon: {
      marginLeft: spacing.small,
    },
    disabled: {
      opacity: 0.5,
    },
    // Size styles
    buttonSmall: { paddingVertical: spacing.tight, paddingHorizontal: spacing.medium },
    buttonMedium: { paddingVertical: spacing.small, paddingHorizontal: spacing.large },
    buttonLarge: { paddingVertical: spacing.medium, paddingHorizontal: spacing.xlarge },
    textSmall: { fontSize: typography.secondary },
    textMedium: { fontSize: typography.body },
    textLarge: { fontSize: typography.subtitle },
  }),
});

const ButtonComponent: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const variantStyle = styles.variants[variant];

  const getSizeButtonStyle = () => {
    switch (size) {
      case 'small':
        return styles.base.buttonSmall;
      case 'large':
        return styles.base.buttonLarge;
      default:
        return styles.base.buttonMedium;
    }
  };

  const getSizeTextStyle = () => {
    switch (size) {
      case 'small':
        return styles.base.textSmall;
      case 'large':
        return styles.base.textLarge;
      default:
        return styles.base.textMedium;
    }
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base.button,
        variantStyle.button,
        getSizeButtonStyle(),
        isDisabled && styles.base.disabled,
        style,
      ]}
      onPress={() => onPress({ disabled: !!disabled, loading: !!loading })}
      activeOpacity={isDisabled ? 1 : 0.7}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.textInverse} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.base.text,
              variantStyle.text,
              getSizeTextStyle(),
              icon ? styles.base.textWithIcon : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// Memoize to prevent unnecessary re-renders
export const Button = memo(ButtonComponent);

