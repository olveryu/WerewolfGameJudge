/**
 * PendingSeatsRow — the one rendering of a "who has not submitted" list.
 *
 * Shared by every surface that shows pending seats (sheriff HUD, sheriff
 * panel vote-progress row, avalon history-summary bar, avalon vote/quest
 * modals): a label plus one SeatDot per pending seat. The text form for
 * surfaces that cannot render dots (bottom message, record rows, night
 * review) is {@link formatPendingSeats} — same words, same order, one
 * implementation for each form.
 *
 * Seats are 0-based engine seats; SeatDot and formatSeat render them
 * 1-based. Renders nothing when no seat is pending.
 */

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import { colors, spacing, textStyles, typography } from '@/theme';

export interface PendingSeatsRowProps {
  /** Caller-owned label, e.g. '未投票' or '未出牌'. */
  readonly label: string;
  /** 0-based pending seats, ascending. */
  readonly seats: readonly number[];
  readonly testID?: string;
}

/** "未投票：2号 4号" — the text form of a pending-seats list. Empty when no seat is pending. */
export function formatPendingSeats(label: string, seats: readonly number[]): string {
  if (seats.length === 0) return '';
  return `${label}：${seats.map((seat) => formatSeat(seat)).join(' ')}`;
}

export const PendingSeatsRow = memo<PendingSeatsRowProps>(({ label, seats, testID }) => {
  if (seats.length === 0) return null;
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.label} testID={testID === undefined ? undefined : `${testID}-label`}>
        {label}：
      </Text>
      {seats.map((seat) => (
        <SeatDot
          key={seat}
          seat={seat}
          size="sm"
          testID={testID === undefined ? undefined : `${testID}-seat-${seat}`}
        />
      ))}
    </View>
  );
});

PendingSeatsRow.displayName = 'PendingSeatsRow';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.tight,
  },
  label: {
    ...textStyles.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
});
