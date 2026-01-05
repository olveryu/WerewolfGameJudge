import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS } from '../../constants';

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
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variantStyle.button,
        sizeStyle.button,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? COLORS.primary : COLORS.text}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              variantStyle.text,
              sizeStyle.text,
              icon ? styles.textWithIcon : null,
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

const VARIANT_STYLES = {
  primary: StyleSheet.create({
    button: { backgroundColor: COLORS.primary },
    text: { color: COLORS.text },
  }),
  secondary: StyleSheet.create({
    button: { backgroundColor: COLORS.secondary },
    text: { color: COLORS.text },
  }),
  danger: StyleSheet.create({
    button: { backgroundColor: COLORS.danger },
    text: { color: COLORS.text },
  }),
  outline: StyleSheet.create({
    button: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: COLORS.primary,
    },
    text: { color: COLORS.primary },
  }),
};

const SIZE_STYLES = {
  small: StyleSheet.create({
    button: { paddingVertical: 8, paddingHorizontal: 16 },
    text: { fontSize: 14 },
  }),
  medium: StyleSheet.create({
    button: { paddingVertical: 12, paddingHorizontal: 24 },
    text: { fontSize: 16 },
  }),
  large: StyleSheet.create({
    button: { paddingVertical: 16, paddingHorizontal: 32 },
    text: { fontSize: 18 },
  }),
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  text: {
    fontWeight: '600',
  },
  textWithIcon: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
