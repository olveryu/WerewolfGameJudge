/**
 * FormTextField — generic text input component.
 *
 * Unifies TextInput style and behavior across form fields and search bars in the project.
 * Supports ref forwarding, two variants (default form / search bar), error display, and a left icon.
 * Styles use theme tokens; contains no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type Ref } from 'react';
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

import { borderRadius, colors, componentSizes, fixed, spacing, typography } from '@/theme';

// ── Types ────────────────────────────────────────────────

interface FormTextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Variant: 'default' = bordered form field | 'search' = rounded search bar (with container) */
  variant?: 'default' | 'search';
  /** Left icon (Ionicons name); rendered inside the container for the search variant */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Error message (shown below the input for the default variant) */
  error?: string;
  /** Extra style merged onto the TextInput */
  style?: StyleProp<TextStyle>;
  /** Extra container style */
  containerStyle?: StyleProp<ViewStyle>;
  /** Ref forwarded to the underlying TextInput */
  ref?: Ref<TextInput>;
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
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

// ── Component ────────────────────────────────────────────

export function FormTextField({
  variant = 'default',
  icon,
  error,
  style,
  containerStyle,
  placeholderTextColor,
  ref,
  ...rest
}: FormTextFieldProps) {
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
}
