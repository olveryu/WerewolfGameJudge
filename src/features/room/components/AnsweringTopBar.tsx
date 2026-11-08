/**
 * Shared answering top bar (v3): a white capsule with a countdown ring,
 * a stack of seat avatars showing who has submitted, and a status line.
 *
 * Story Relay and Pictionary render the identical bar — same ring, same
 * avatars, same wording ("作答中 / 已提交"). The bar reads only
 * remaining/total seconds and the seat list the caller derived; it never
 * reads game state.
 *
 * Ring boundary states (plan §14): no limit shows "不限时" with no arc,
 * 0 seconds shows "0秒" with an empty arc, 10 seconds or less turns the
 * arc red.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { borderRadius, colors, fixed, shadows, spacing, textStyles, typography } from '@/theme';

import {
  ANSWERING_TOP_BAR_OVERFLOW_COLOR,
  type AnsweringTopBarSeat,
} from '../model/answeringTopBarSeats';

/** v3 ring colours: track, arc, and the green that marks a submitted seat. */
const RING_TRACK_COLOR = '#EDEDF3';
const RING_ARC_COLOR = '#6366F1';
const READY_GREEN = '#22C55E';

const RING_SIZE = 36;
const RING_RADIUS = 15;
const RING_STROKE_WIDTH = 4;
/** 2π × 15, the mock's dasharray. */
const RING_CIRCUMFERENCE = 94.2;
const AVATAR_SIZE = 24;
const STATUS_DOT_SIZE = 11;
const MAX_VISIBLE_SEATS = 8;
const URGENT_SECONDS = 10;

interface AnsweringTopBarProps {
  /** Null means the stage has no time limit. */
  readonly remainingSeconds: number | null;
  /** Null means the stage has no time limit. */
  readonly totalSeconds: number | null;
  readonly seats: readonly AnsweringTopBarSeat[];
}

export const AnsweringTopBar: React.FC<AnsweringTopBarProps> = ({
  remainingSeconds,
  totalSeconds,
  seats,
}) => {
  const submittedCount = seats.filter((seat) => seat.submitted).length;
  const answeringCount = seats.length - submittedCount;
  const visibleSeats = seats.slice(0, MAX_VISIBLE_SEATS);
  const overflowCount = seats.length - visibleSeats.length;
  const isUnlimited = remainingSeconds === null || totalSeconds === null;
  const isUrgent =
    remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= URGENT_SECONDS;
  const arcColor = isUrgent ? colors.error : RING_ARC_COLOR;
  const dashOffset =
    remainingSeconds === null || totalSeconds === null || totalSeconds === 0
      ? RING_CIRCUMFERENCE
      : RING_CIRCUMFERENCE * (1 - remainingSeconds / totalSeconds);
  return (
    <View
      style={styles.bar}
      testID="answering-top-bar"
      accessibilityLabel={`作答进度：${answeringCount}人作答中，${submittedCount}人已提交`}
    >
      <View
        style={styles.ring}
        testID="answering-top-bar-ring"
        accessibilityLabel={isUnlimited ? '本阶段不限时' : `剩余 ${remainingSeconds} 秒`}
      >
        <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={RING_TRACK_COLOR}
            strokeWidth={RING_STROKE_WIDTH}
          />
          {!isUnlimited && (
            <G transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={arcColor}
                strokeWidth={RING_STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={String(RING_CIRCUMFERENCE)}
                strokeDashoffset={dashOffset}
                testID="answering-top-bar-ring-arc"
              />
            </G>
          )}
        </Svg>
        <View style={styles.ringCenter}>
          {isUnlimited ? (
            <Text style={styles.ringUnlimited}>不限时</Text>
          ) : (
            <>
              <Text style={styles.ringNumber}>{remainingSeconds}</Text>
              <Text style={styles.ringUnit}>秒</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.avatarStack}>
        {visibleSeats.map((seat) => (
          <View
            key={seat.seat}
            testID={`answering-top-bar-avatar-${seat.seat}`}
            style={[styles.avatar, { backgroundColor: seat.color }]}
            accessibilityLabel={`${seat.displayName}：${seat.submitted ? '已提交' : '作答中'}`}
          >
            {seat.submitted && (
              <View testID="answering-top-bar-ready-ring" style={styles.readyRing} />
            )}
            <Text style={styles.avatarInitial}>{seat.initial}</Text>
            <View
              testID={`answering-top-bar-dot-${seat.seat}`}
              style={[
                styles.statusDot,
                { backgroundColor: seat.submitted ? READY_GREEN : RING_ARC_COLOR },
              ]}
            >
              {seat.submitted && <Ionicons name="checkmark" size={8} color={colors.textInverse} />}
            </View>
          </View>
        ))}
        {overflowCount > 0 && (
          <View
            testID="answering-top-bar-overflow"
            style={[styles.avatar, { backgroundColor: ANSWERING_TOP_BAR_OVERFLOW_COLOR }]}
            accessibilityLabel={`还有 ${overflowCount} 人`}
          >
            <Text style={styles.avatarInitial}>+{overflowCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.status}>
        <Text style={styles.statusAnswering}>{answeringCount}人作答中</Text>
        <Text style={styles.statusSubmitted}> · {submittedCount}已提交</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    // No top margin and tight vertical padding: at the reduced keyboard
    // viewport (390x480) the Pictionary guess stage is only ~286px tall,
    // and every pixel above the bar is a pixel the composer cannot use.
    // Both games share this bar, so they stay identical.
    marginTop: 0,
    marginHorizontal: spacing.medium,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    ...shadows.lg,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    flexShrink: 0,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNumber: {
    ...textStyles.body,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  ringUnit: {
    ...textStyles.captionSmall,
    color: colors.textMuted,
  },
  ringUnlimited: {
    ...textStyles.captionSmall,
    color: colors.text,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    flexShrink: 0,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...textStyles.captionSmall,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  /** Green ring painted outside the white border; absolute so it never shifts layout. */
  readyRing: {
    position: 'absolute',
    top: -fixed.borderWidthThick,
    left: -fixed.borderWidthThick,
    right: -fixed.borderWidthThick,
    bottom: -fixed.borderWidthThick,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidthThick,
    borderColor: READY_GREEN,
  },
  statusDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: STATUS_DOT_SIZE,
    height: STATUS_DOT_SIZE,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    ...textStyles.secondary,
    flexShrink: 0,
  },
  statusAnswering: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statusSubmitted: {
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
});
