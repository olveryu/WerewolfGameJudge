/** Viewport-bounded task layout; media fits available space without cropping or page scrolling. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { RoomTaskViewport } from '@/features/room/components/RoomTaskViewport';
import { TESTIDS } from '@/testids';
import { colors, fixed, spacing, textStyles } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { PICTIONARY_STAGE_MAX_WIDTH } from './PictionaryStageFrame';

interface PictionaryTaskFrameProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly remainingSeconds: number | null;
  readonly children: React.ReactNode;
  readonly footer: React.ReactNode;
}

const FINAL_COUNTDOWN_SECONDS = 5;

/** Keep the task timer and completion controls visible, including above the web keyboard. */
export function PictionaryTaskFrame({
  eyebrow,
  title,
  remainingSeconds,
  children,
  footer,
}: PictionaryTaskFrameProps) {
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
          : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  return (
    <RoomTaskViewport>
      <View style={styles.task} testID={TESTIDS.pictionaryStageFrame}>
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
        <View style={styles.body}>{children}</View>
        <View style={styles.footer}>{footer}</View>
      </View>
    </RoomTaskViewport>
  );
}

/** Fit a canonical 4:3 drawing into the remaining task area. */
export function PictionaryTaskMedia({ children }: { readonly children: React.ReactNode }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = Math.min(size.width, (size.height * 4) / 3);
  return (
    <View
      style={styles.media}
      onLayout={({ nativeEvent }) =>
        setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })
      }
    >
      <View style={{ width, height: (width * 3) / 4 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  task: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: PICTIONARY_STAGE_MAX_WIDTH,
    alignSelf: 'center',
    padding: spacing.small,
    gap: spacing.small,
  },
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
  body: { flex: 1, minHeight: 0, gap: spacing.small },
  footer: {
    flexShrink: 0,
    gap: spacing.tight,
    paddingTop: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
  },
  media: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
