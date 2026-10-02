/**
 * SegmentedControl — generic two-segment switch component.
 *
 * Used for the top tab switch on EncyclopediaScreen ("Roles | Boards").
 * Pure presentational component — no business logic, no service dependencies.
 */
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { borderRadius, colors, fixed, spacing, typography, withAlpha } from '@/theme';

interface Segment<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  activeKey: T | null;
  onChangeKey: (key: T) => void;
  style?: ViewStyle;
  disabled?: boolean;
}

/** Generic segmented control. Null activeKey renders no active segment. */
export function SegmentedControl<T extends string>({
  segments,
  activeKey,
  onChangeKey,
  style,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style, disabled && styles.containerDisabled]}>
      {segments.map((segment) => {
        const isActive = segment.key === activeKey;
        return (
          <Pressable
            key={segment.key}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChangeKey(segment.key)}
            disabled={disabled || undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, ...(disabled ? { disabled: true } : {}) }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: spacing.screenH,
    marginTop: spacing.small,
    marginBottom: spacing.small,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    padding: spacing.micro,
    gap: spacing.micro,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.small,
    borderRadius: borderRadius.small,
  },
  segmentActive: {
    backgroundColor: withAlpha(colors.primary, 0.15),
  },
  label: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  containerDisabled: {
    opacity: fixed.disabledOpacity,
  },
});
