/**
 * 阿瓦隆座位选择器：组队多选、查验/刺杀单选的通用座位网格。
 *
 * Presentational: 只渲染席位并上报点选意图，选择资格由调用方（policy）决定。
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

export interface AvalonSeatPickerEntry {
  readonly seat: number;
  readonly displayName: string;
}

/** 座位网格；selected/disabled 集合由调用方按 policy 算好传入。 */
export function AvalonSeatPicker({
  seats,
  selectedSeats,
  disabledSeats,
  onSelect,
  testIDPrefix,
}: {
  readonly seats: readonly AvalonSeatPickerEntry[];
  readonly selectedSeats: ReadonlySet<number>;
  readonly disabledSeats: ReadonlySet<number>;
  readonly onSelect: (seat: number) => void;
  readonly testIDPrefix: string;
}) {
  return (
    <View style={styles.grid}>
      {seats.map((entry) => {
        const isSelected = selectedSeats.has(entry.seat);
        const isDisabled = disabledSeats.has(entry.seat);
        return (
          <TouchableOpacity
            key={entry.seat}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isDisabled && styles.chipDisabled,
            ]}
            activeOpacity={fixed.activeOpacity}
            accessibilityRole="button"
            accessibilityLabel={`${entry.seat + 1} 号座位 ${entry.displayName}`}
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
            testID={`${testIDPrefix}-seat-${entry.seat}`}
            onPress={() => {
              if (!isDisabled) onSelect(entry.seat);
            }}
          >
            <Text style={[styles.seatLabel, isSelected && styles.seatLabelSelected]}>
              {entry.seat + 1} 号
            </Text>
            <Text
              style={[styles.seatName, isSelected && styles.seatNameSelected]}
              numberOfLines={1}
            >
              {entry.displayName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  chip: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.tight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipDisabled: {
    opacity: fixed.disabledOpacity,
  },
  seatLabel: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  seatLabelSelected: {
    color: colors.primaryDark,
  },
  seatName: {
    ...textStyles.secondary,
    color: colors.text,
  },
  seatNameSelected: {
    color: colors.primaryDark,
  },
});
