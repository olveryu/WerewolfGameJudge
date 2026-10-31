/**
 * Pictionary task heading: eyebrow, title and the task timer.
 *
 * Pictionary-owned presentation moved out of PictionaryTaskFrame when
 * the frame skeleton moved to the shared RoomTaskFrame. The countdown
 * semantics (unlimited, collecting, final-seconds) stay with this game.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { formatCountdownSeconds } from '@/features/room/model/formatCountdown';
import { colors, fixed, spacing, textStyles } from '@/theme';
import { componentSizes } from '@/theme/tokens';

const FINAL_COUNTDOWN_SECONDS = 5;

interface PictionaryTaskHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly remainingSeconds: number | null;
}

/** Task heading with the live timer; the final countdown shows bare seconds. */
export const PictionaryTaskHeading: React.FC<PictionaryTaskHeadingProps> = ({
  eyebrow,
  title,
  remainingSeconds,
}) => {
  const isFinalCountdown =
    remainingSeconds !== null &&
    remainingSeconds > 0 &&
    remainingSeconds <= FINAL_COUNTDOWN_SECONDS;
  const timerText =
    remainingSeconds === null
      ? '不限时'
      : remainingSeconds === 0
        ? '收稿中'
        : isFinalCountdown
          ? String(remainingSeconds)
          : formatCountdownSeconds(remainingSeconds);
  return (
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View
        style={[styles.timer, isFinalCountdown && styles.finalTimer]}
        accessibilityLiveRegion={isFinalCountdown ? 'assertive' : 'none'}
        accessibilityLabel={
          remainingSeconds === null ? '本阶段不限时' : `剩余 ${remainingSeconds} 秒`
        }
      >
        {!isFinalCountdown && (
          <Ionicons
            name="time-outline"
            size={componentSizes.icon.sm}
            color={colors.textSecondary}
          />
        )}
        <Text style={[styles.timerText, isFinalCountdown && styles.countdownText]}>
          {timerText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    minHeight: fixed.minTouchTarget,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...textStyles.caption, color: colors.textSecondary },
  title: roomSurfaceStyles.title,
  timer: roomSurfaceStyles.timer,
  timerText: roomSurfaceStyles.timerText,
  finalTimer: { backgroundColor: colors.error, borderRadius: fixed.minTouchTarget / 2 },
  countdownText: {
    ...textStyles.headingBold,
    color: colors.textInverse,
    fontVariant: ['tabular-nums'],
  },
});
