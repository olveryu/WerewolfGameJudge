/**
 * CountdownPill — Shared countdown display for all game timers.
 *
 * Single visual language (G4): pill with clock icon, urgent (red) at
 * URGENT_THRESHOLD_SECONDS or below. Games only supply the zero label.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

export const COUNTDOWN_URGENT_THRESHOLD_SECONDS = 10;

interface CountdownPillProps {
  readonly remainingSeconds: number | null;
  /** Label shown when the timer hits zero, e.g. '收稿中'. */
  readonly zeroLabel: string;
  readonly testID?: string;
}

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${seconds}秒`;
}

const CountdownPillComponent: React.FC<CountdownPillProps> = ({
  remainingSeconds,
  zeroLabel,
  testID,
}) => {
  const isUrgent =
    remainingSeconds !== null &&
    remainingSeconds > 0 &&
    remainingSeconds <= COUNTDOWN_URGENT_THRESHOLD_SECONDS;
  const text =
    remainingSeconds === null
      ? '不限时'
      : remainingSeconds === 0
        ? zeroLabel
        : formatCountdown(remainingSeconds);

  return (
    <View
      style={[styles.pill, isUrgent && styles.urgentPill]}
      accessibilityLiveRegion={isUrgent ? 'assertive' : 'polite'}
      accessibilityLabel={
        remainingSeconds === null ? '本阶段不限时' : `剩余 ${remainingSeconds} 秒`
      }
      testID={testID}
    >
      <Ionicons
        name="time-outline"
        size={componentSizes.icon.sm}
        color={isUrgent ? colors.error : colors.textSecondary}
      />
      <Text style={[styles.text, isUrgent && styles.urgentText]}>{text}</Text>
    </View>
  );
};

export const CountdownPill = memo(CountdownPillComponent);
CountdownPill.displayName = 'CountdownPill';

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  urgentPill: {
    backgroundColor: withAlpha(colors.error, 0.12),
  },
  text: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  urgentText: {
    color: colors.error,
  },
});
