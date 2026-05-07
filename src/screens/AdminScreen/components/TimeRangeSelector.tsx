/**
 * TimeRangeSelector — Time preset pills + custom date range input
 *
 * Encapsulates the shared time selection UI used by StatsTab and AnalyticsTab.
 * Manages its own preset/custom state, calls onRangeChange when a valid range is selected.
 */

import type React from 'react';
import { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { borderRadius, colors, spacing, typography } from '@/theme';

import { getTimeRange, type TimePreset } from '../adminApi';
import { AdminPill } from './AdminPill';

const PRESET_LABELS: Record<TimePreset, string> = {
  today: '今天',
  '7d': '近7天',
  '30d': '近30天',
  custom: '自定义',
} as const;

const PRESETS: readonly TimePreset[] = ['today', '7d', '30d', 'custom'] as const;

interface TimeRangeSelectorProps {
  onRangeChange: (range: { from: string; to: string }) => void;
}

const TimeRangeSelectorComponent: React.FC<TimeRangeSelectorProps> = ({ onRangeChange }) => {
  const [preset, setPreset] = useState<TimePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (preset !== 'custom') {
      onRangeChange(getTimeRange(preset));
    }
  }, [preset, onRangeChange]);

  const handlePresetPress = useCallback((p: TimePreset) => {
    setPreset(p);
  }, []);

  const handleCustomSearch = useCallback(() => {
    if (customFrom && customTo) {
      onRangeChange({
        from: `${customFrom}T00:00:00Z`,
        to: `${customTo}T23:59:59Z`,
      });
    }
  }, [customFrom, customTo, onRangeChange]);

  return (
    <View>
      <View style={styles.pillRow}>
        {PRESETS.map((p) => (
          <AdminPill
            key={p}
            label={PRESET_LABELS[p]}
            isActive={preset === p}
            onPress={() => handlePresetPress(p)}
          />
        ))}
      </View>

      {preset === 'custom' && (
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="开始日期 (YYYY-MM-DD)"
            placeholderTextColor={colors.textMuted}
            value={customFrom}
            onChangeText={setCustomFrom}
          />
          <Text style={styles.customSep}>~</Text>
          <TextInput
            style={styles.customInput}
            placeholder="结束日期 (YYYY-MM-DD)"
            placeholderTextColor={colors.textMuted}
            value={customTo}
            onChangeText={setCustomTo}
          />
          <PressableScale style={styles.customBtn} onPress={handleCustomSearch}>
            <Text style={styles.customBtnText}>查</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
};

export const TimeRangeSelector = memo(TimeRangeSelectorComponent);

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    gap: spacing.tight,
    marginBottom: spacing.small,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    marginBottom: spacing.small,
  },
  customInput: {
    flex: 1,
    height: 36,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.tight,
    fontSize: typography.captionSmall,
    color: colors.text,
  },
  customSep: {
    color: colors.textMuted,
  },
  customBtn: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.primary,
  },
  customBtnText: {
    color: colors.textInverse,
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
  },
});
