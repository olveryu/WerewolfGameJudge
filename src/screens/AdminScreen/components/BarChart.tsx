/**
 * BarChart — Horizontal bar chart for distribution data
 *
 * Renders a list of labeled horizontal bars with proportional fill.
 * Value is shown inline when bar is wide enough, otherwise to the right.
 * Used by StatsTab (country/colo) and AnalyticsTab (country/colo/ISP).
 */

import type React from 'react';
import { memo, useMemo } from 'react';
import { type DimensionValue, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, typography } from '@/theme';

interface BarChartItem {
  label: string;
  value: number;
  /** Optional display string for the value column (e.g. "123 ms"). Defaults to `String(value)` */
  displayValue?: string;
}

interface BarChartProps {
  title: string;
  items: readonly BarChartItem[];
  /** Width of the label column. Defaults to 36 */
  labelWidth?: number;
}

/** Threshold: if bar fill >= 40%, show value inside the bar */
const INLINE_THRESHOLD = 0.4;

const BarChartComponent: React.FC<BarChartProps> = ({ title, items, labelWidth = 36 }) => {
  const maxValue = useMemo(() => {
    if (items.length === 0) return 1;
    return items[0]!.value;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => {
        const ratio = item.value / maxValue;
        const percent = `${(ratio * 100).toFixed(0)}%` as DimensionValue;
        const showInline = ratio >= INLINE_THRESHOLD;
        const display = item.displayValue ?? String(item.value);

        return (
          <View key={item.label} style={styles.barRow}>
            <Text style={[styles.barLabel, { width: labelWidth }]}>{item.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: percent }]}>
                {showInline && <Text style={styles.barValueInline}>{display}</Text>}
              </View>
            </View>
            {!showInline && <Text style={styles.barValueExternal}>{display}</Text>}
          </View>
        );
      })}
    </View>
  );
};

export const BarChart = memo(BarChartComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.medium,
  },
  title: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.tight,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.tight,
    gap: spacing.tight,
  },
  barLabel: {
    fontSize: typography.captionSmall,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 20,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.small,
    justifyContent: 'center',
    paddingHorizontal: spacing.tight,
  },
  barValueInline: {
    fontSize: typography.captionSmall,
    color: colors.textInverse,
    fontWeight: typography.weights.semibold,
    textAlign: 'right',
  },
  barValueExternal: {
    width: 50,
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
