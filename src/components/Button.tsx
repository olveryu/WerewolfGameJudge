/**
 * Button — Unified button primitive
 *
 * Token-based, variant-driven button built on PressableScale.
 * Covers primary / secondary / danger / ghost / icon variants with sm / md / lg sizes.
 * Provides loading state, disabled visual + behavioral gating, and optional haptic feedback.
 *
 * Does not contain business logic. Renders UI and forwards press intent.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme';
import { borderRadius, componentSizes, fixed, spacing, textStyles } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

// ── Types ─────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonVisualProps {
  /** Visual & semantic variant (default: 'primary') */
  variant?: ButtonVariant;
  /** Height / dimension tier (default: 'md') */
  size?: ButtonSize;
  /** Button content — strings are auto-wrapped in styled Text */
  children?: React.ReactNode;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Show spinner and auto-disable */
  loading?: boolean;
  /** Override background color (e.g. dynamic factionColor) */
  buttonColor?: string;
  /** Override text / spinner color */
  textColor?: string;
  /** Trigger haptic on press */
  haptic?: boolean;
  /** Container style override */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

type ButtonProps = ButtonVisualProps &
  (
    | {
        /** Normal action. Never runs while disabled or loading. */
        onPress: () => void;
        disabled?: boolean;
        /** Explicit feedback action for a visually disabled button. */
        onDisabledPress?: () => void;
      }
    | {
        /** A permanently disabled display button has no normal action. */
        onPress?: never;
        disabled: true;
        onDisabledPress?: () => void;
      }
  );

type PressInteraction =
  | { readonly onPress: () => void; readonly disabled?: false }
  | { readonly onPress?: never; readonly disabled: true };

function resolvePressInteraction(props: ButtonProps, isLoading: boolean): PressInteraction {
  if (isLoading) return { disabled: true };
  if (props.disabled === true) {
    return props.onDisabledPress === undefined
      ? { disabled: true }
      : { onPress: props.onDisabledPress };
  }
  return { onPress: props.onPress };
}

// ── Size mappings ─────────────────────────────────────────────────────────────

/** minHeight for text-bearing variants (primary / secondary / danger / ghost) */
const BUTTON_HEIGHTS: Record<ButtonSize, number> = {
  sm: componentSizes.button.sm,
  md: componentSizes.button.md,
  lg: componentSizes.button.lg,
};

/** Square dimension for icon variant */
const ICON_DIMENSIONS: Record<ButtonSize, number> = {
  sm: componentSizes.button.sm, // 32
  md: componentSizes.avatar.md, // 40  — matches existing iconButton pattern
  lg: componentSizes.avatar.lg, // 56
};

/** Text preset per size */
const TEXT_STYLES: Record<ButtonSize, TextStyle> = {
  sm: textStyles.secondarySemibold,
  md: textStyles.bodySemibold,
  lg: textStyles.subtitleSemibold,
};

// ── Component ─────────────────────────────────────────────────────────────────

const ButtonComponent: React.FC<ButtonProps> = (props) => {
  const {
    variant = 'primary',
    size = 'md',
    children,
    icon,
    disabled = false,
    loading = false,
    buttonColor,
    textColor: textColorProp,
    haptic = false,
    style,
    testID,
    accessibilityLabel,
  } = props;
  const isDisabled = disabled || loading;
  const pressInteraction = resolvePressInteraction(props, loading);

  // ── Computed styles ───────────────────────────────────────────────────────

  const { containerStyle, resolvedTextColor, useGradient } = useMemo(() => {
    const base: ViewStyle = {
      justifyContent: 'center',
      alignItems: 'center',
    };

    let bg: string;
    let txtColor: string;

    switch (variant) {
      case 'primary':
        txtColor = textColorProp ?? colors.textInverse;
        if (buttonColor) {
          // Custom buttonColor: solid fill, no gradient
          bg = buttonColor;
          Object.assign(base, {
            backgroundColor: bg,
            borderRadius: borderRadius.full,
            minHeight: BUTTON_HEIGHTS[size],
            paddingHorizontal: spacing.large,
          });
        } else {
          // Default: transparent + gradient overlay
          bg = 'transparent';
          Object.assign(base, {
            backgroundColor: bg,
            borderRadius: borderRadius.full,
            minHeight: BUTTON_HEIGHTS[size],
            paddingHorizontal: spacing.large,
            overflow: 'hidden' as const,
          });
        }
        break;

      case 'secondary':
        bg = 'transparent';
        txtColor = textColorProp ?? colors.text;
        Object.assign(base, {
          backgroundColor: bg,
          borderRadius: borderRadius.full,
          borderWidth: fixed.borderWidth,
          borderColor: buttonColor ?? colors.border,
          minHeight: BUTTON_HEIGHTS[size],
          paddingHorizontal: spacing.large,
        });
        break;

      case 'danger':
        bg = buttonColor ?? colors.error;
        txtColor = textColorProp ?? colors.textInverse;
        Object.assign(base, {
          backgroundColor: bg,
          borderRadius: borderRadius.full,
          minHeight: BUTTON_HEIGHTS[size],
          paddingHorizontal: spacing.large,
        });
        break;

      case 'ghost':
        bg = buttonColor ?? 'transparent';
        txtColor = textColorProp ?? colors.textSecondary;
        Object.assign(base, {
          backgroundColor: bg,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.small,
          paddingVertical: spacing.small,
        });
        break;

      case 'icon': {
        const dim = ICON_DIMENSIONS[size];
        bg = buttonColor ?? colors.background;
        txtColor = textColorProp ?? colors.textSecondary;
        Object.assign(base, {
          backgroundColor: bg,
          borderRadius: borderRadius.full,
          width: dim,
          height: dim,
          overflow: 'hidden' as const,
        });
        break;
      }
    }

    if (isDisabled) {
      base.opacity = fixed.disabledOpacity;
    }

    const useGradient = variant === 'primary' && !buttonColor;

    return { containerStyle: base, resolvedTextColor: txtColor, useGradient };
  }, [variant, size, buttonColor, textColorProp, isDisabled]);

  // ── Text style ────────────────────────────────────────────────────────────

  const computedTextStyle: TextStyle = useMemo(
    () => ({
      ...TEXT_STYLES[size],
      color: resolvedTextColor,
    }),
    [size, resolvedTextColor],
  );

  // ── Content rendering ─────────────────────────────────────────────────────

  const content = useMemo(() => {
    if (loading) {
      return <ActivityIndicator color={resolvedTextColor} />;
    }

    const hasIcon = icon != null;
    const isStringChild = typeof children === 'string';

    // icon variant: render children directly (expected to be an icon ReactNode)
    if (variant === 'icon') {
      return children;
    }

    // icon + text combination
    if (hasIcon && isStringChild) {
      return (
        <View style={ROW_STYLE}>
          {icon}
          <Text style={computedTextStyle}>{children}</Text>
        </View>
      );
    }

    // text-only (auto-wrap string in styled Text)
    if (isStringChild) {
      return <Text style={computedTextStyle}>{children}</Text>;
    }

    // ReactNode children — render as-is
    return children;
  }, [loading, icon, children, variant, resolvedTextColor, computedTextStyle]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PressableScale
      {...pressInteraction}
      activeScale={isDisabled ? 1 : undefined}
      haptic={haptic && !isDisabled}
      style={[containerStyle, style]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {useGradient && (
        <LinearGradient
          colors={[colors.primaryLight, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {content}
    </PressableScale>
  );
};

/** Row layout for icon + text */
const ROW_STYLE: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.tight,
};

export const Button = memo(ButtonComponent);

Button.displayName = 'Button';
