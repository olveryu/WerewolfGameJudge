import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useColors, spacing, borderRadius, typography, ThemeColors } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
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
      borderRadius: borderRadius.md,
    },
    text: {
      fontWeight: '600',
    },
    textWithIcon: {
      marginLeft: spacing.sm,
    },
    disabled: {
      opacity: 0.5,
    },
    // Size styles
    buttonSmall: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    buttonMedium: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
    buttonLarge: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
    textSmall: { fontSize: typography.sm },
    textMedium: { fontSize: typography.base },
    textLarge: { fontSize: typography.lg },
  }),
});

const Button: React.FC<ButtonProps> = ({
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

  return (
    <TouchableOpacity
      style={[
        styles.base.button,
        variantStyle.button,
        getSizeButtonStyle(),
        disabled && styles.base.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
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

export default Button;
